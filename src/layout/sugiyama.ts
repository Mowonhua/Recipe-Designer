import type { FlowEdge, ItemNode, LayoutDirection } from '../store';

type Point = { x: number; y: number };

interface SugiyamaLayoutInput {
  direction: LayoutDirection;
  nodes: ItemNode[];
  edges: FlowEdge[];
  nodeWidth?: number;
  nodeHeight?: number;
  nodeGap?: number;
  layerGap?: number;
  horizontalLayerGap?: number;
  sweepCount?: number;
}

interface LayoutSettings {
  nodeWidth: number;
  nodeHeight: number;
  nodeGap: number;
  layerGap: number;
  horizontalLayerGap: number;
  sweepCount: number;
}

interface LayoutNodeState {
  id: string;
  layer: number;
  order: number;
  inputIndex: number;
  originalSpread: number;
}

interface LayoutEdge {
  source: string;
  target: string;
  minSpan: number;
  originalIndex: number;
}

const DEFAULT_NODE_WIDTH = 170;
const DEFAULT_NODE_HEIGHT = 60;
const DEFAULT_NODE_GAP = 40;
const DEFAULT_LAYER_GAP = 160;
const DEFAULT_HORIZONTAL_LAYER_GAP = 230;
const DEFAULT_SWEEP_COUNT = 8;

// 该入口执行完整 Sugiyama 流程：生产边归一、循环边移除、最长路径分层、barycenter 降交叉、坐标映射。
export function calculateSugiyamaLayout(input: SugiyamaLayoutInput): Map<string, Point> {
  const settings = normalizeSettings(input);
  const nodeStates = createNodeStates(input.nodes, input.direction);
  if (nodeStates.size === 0) return new Map();

  const layoutEdges = collectLayoutEdges(input.edges, nodeStates);
  const acyclicEdges = removeCycleEdges(nodeStates, layoutEdges);

  assignLayers(nodeStates, acyclicEdges);
  const layers = buildLayers(nodeStates);
  minimizeCrossings(layers, nodeStates, acyclicEdges, settings.sweepCount);

  return assignCoordinates(layers, nodeStates, input.direction, settings);
}

// 该函数合并调用方配置和默认布局常量，保证布局模块在测试和编辑器里使用一致的尺寸语义。
function normalizeSettings(input: SugiyamaLayoutInput): LayoutSettings {
  return {
    nodeWidth: input.nodeWidth ?? DEFAULT_NODE_WIDTH,
    nodeHeight: input.nodeHeight ?? DEFAULT_NODE_HEIGHT,
    nodeGap: input.nodeGap ?? DEFAULT_NODE_GAP,
    layerGap: input.layerGap ?? DEFAULT_LAYER_GAP,
    horizontalLayerGap: input.horizontalLayerGap ?? DEFAULT_HORIZONTAL_LAYER_GAP,
    sweepCount: input.sweepCount ?? DEFAULT_SWEEP_COUNT,
  };
}

// 该函数建立布局节点状态；原始 spread 轴位置用于保留用户手动排布的相对顺序作为稳定排序兜底。
function createNodeStates(nodes: ItemNode[], direction: LayoutDirection): Map<string, LayoutNodeState> {
  const isHorizontal = direction === 'LR';
  const nodeStates = new Map<string, LayoutNodeState>();

  nodes.forEach((node, index) => {
    nodeStates.set(node.id, {
      id: node.id,
      layer: 0,
      order: index,
      inputIndex: index,
      originalSpread: isHorizontal ? node.position.y : node.position.x,
    });
  });

  return nodeStates;
}

// 该函数只采纳参与生产层级的边；input/catalyst 推进一层，byproduct 与产生它的配方节点同层。
function collectLayoutEdges(edges: FlowEdge[], nodeStates: Map<string, LayoutNodeState>): LayoutEdge[] {
  const edgeByPair = new Map<string, LayoutEdge>();

  edges.forEach((edge, index) => {
    if (!nodeStates.has(edge.source) || !nodeStates.has(edge.target)) return;
    if (edge.source === edge.target) return;
    if (edge.edge_type !== 'input' && edge.edge_type !== 'catalyst' && edge.edge_type !== 'byproduct') return;

    const minSpan = edge.edge_type === 'byproduct' ? 0 : 1;
    const key = `${edge.source}\u0000${edge.target}`;
    const existing = edgeByPair.get(key);

    if (!existing) {
      edgeByPair.set(key, { source: edge.source, target: edge.target, minSpan, originalIndex: index });
      return;
    }

    // 同一对节点可能来自多个配方槽；层级约束取更严格的跨度，原始顺序保留第一条边以保持确定性。
    existing.minSpan = Math.max(existing.minSpan, minSpan);
  });

  return [...edgeByPair.values()].sort((a, b) => a.originalIndex - b.originalIndex);
}

// 该函数实现 Sugiyama 的循环移除阶段；遇到 DFS 回边时跳过该边，避免非 DAG 数据让层级松弛无限增长。
function removeCycleEdges(
  nodeStates: Map<string, LayoutNodeState>,
  edges: LayoutEdge[],
): LayoutEdge[] {
  const bySource = groupEdges(edges, 'source');
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const acyclicEdges: LayoutEdge[] = [];

  function visit(id: string) {
    visiting.add(id);

    for (const edge of bySource.get(id) ?? []) {
      if (visiting.has(edge.target)) continue;

      acyclicEdges.push(edge);
      if (!visited.has(edge.target)) {
        visit(edge.target);
      }
    }

    visiting.delete(id);
    visited.add(id);
  }

  const orderedIds = [...nodeStates.values()]
    .sort(compareByOriginalOrder)
    .map(state => state.id);

  for (const id of orderedIds) {
    if (!visited.has(id)) visit(id);
  }

  return acyclicEdges;
}

// 该函数按指定端点聚合边，并按输入顺序排序，确保 DFS、分层和排序阶段都是确定性的。
function groupEdges(edges: LayoutEdge[], endpoint: 'source' | 'target'): Map<string, LayoutEdge[]> {
  const groups = new Map<string, LayoutEdge[]>();

  for (const edge of edges) {
    const key = edge[endpoint];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(edge);
  }

  for (const group of groups.values()) {
    group.sort((a, b) => a.originalIndex - b.originalIndex);
  }

  return groups;
}

// 该函数用最长路径策略分配逻辑层级；原料根保持第 0 层，产物沿 input/catalyst 边逐层向下游推进。
function assignLayers(nodeStates: Map<string, LayoutNodeState>, edges: LayoutEdge[]) {
  const bySource = groupEdges(edges, 'source');
  const indegree = new Map<string, number>();

  for (const id of nodeStates.keys()) {
    indegree.set(id, 0);
  }

  for (const edge of edges) {
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const queue = [...nodeStates.values()]
    .filter(state => (indegree.get(state.id) ?? 0) === 0)
    .sort(compareByOriginalOrder);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLayer = current.layer;

    for (const edge of bySource.get(current.id) ?? []) {
      const target = nodeStates.get(edge.target);
      if (!target) continue;

      target.layer = Math.max(target.layer, currentLayer + edge.minSpan);
      indegree.set(edge.target, (indegree.get(edge.target) ?? 0) - 1);

      if ((indegree.get(edge.target) ?? 0) === 0) {
        queue.push(target);
        queue.sort(compareByOriginalOrder);
      }
    }
  }
}

// 该函数把节点按逻辑层收集成数组；每层初始顺序来自原始画布 spread 轴位置，减少重布局跳动。
function buildLayers(nodeStates: Map<string, LayoutNodeState>): string[][] {
  const layerMap = new Map<number, LayoutNodeState[]>();

  for (const state of nodeStates.values()) {
    if (!layerMap.has(state.layer)) layerMap.set(state.layer, []);
    layerMap.get(state.layer)!.push(state);
  }

  const maxLayer = Math.max(...layerMap.keys());
  const layers: string[][] = [];

  for (let layer = 0; layer <= maxLayer; layer++) {
    const states = layerMap.get(layer) ?? [];
    states.sort(compareByOriginalOrder);
    states.forEach((state, index) => {
      state.order = index;
    });
    layers[layer] = states.map(state => state.id);
  }

  return layers;
}

// 该函数执行多轮上下扫掠；每个节点按相邻层邻居的 barycenter 排序，以降低跨层边交叉。
function minimizeCrossings(
  layers: string[][],
  nodeStates: Map<string, LayoutNodeState>,
  edges: LayoutEdge[],
  sweepCount: number,
) {
  const incoming = groupEdges(edges, 'target');
  const outgoing = groupEdges(edges, 'source');

  for (let sweep = 0; sweep < sweepCount; sweep++) {
    for (let layer = 1; layer < layers.length; layer++) {
      reorderLayer(layers[layer], nodeStates, id => {
        return (incoming.get(id) ?? [])
          .flatMap(edge => {
            const state = nodeStates.get(edge.source);
            return state && state.layer < layer ? [state] : [];
          });
      });
    }

    for (let layer = layers.length - 2; layer >= 0; layer--) {
      reorderLayer(layers[layer], nodeStates, id => {
        return (outgoing.get(id) ?? [])
          .flatMap(edge => {
            const state = nodeStates.get(edge.target);
            return state && state.layer > layer ? [state] : [];
          });
      });
    }
  }
}

// 该函数根据邻居 order 计算 barycenter；没有跨层邻居的节点保持当前顺序以避免无信息抖动。
function reorderLayer(
  ids: string[],
  nodeStates: Map<string, LayoutNodeState>,
  neighborGetter: (id: string) => LayoutNodeState[],
) {
  const ranked = ids.map(id => {
    const state = nodeStates.get(id)!;
    const neighbors = neighborGetter(id);
    const barycenter = neighbors.length === 0
      ? null
      : neighbors.reduce((sum, neighbor) => sum + neighbor.order, 0) / neighbors.length;

    return { id, barycenter, previousOrder: state.order, originalSpread: state.originalSpread, inputIndex: state.inputIndex };
  });

  ranked.sort((a, b) => {
    if (a.barycenter !== null && b.barycenter !== null && a.barycenter !== b.barycenter) {
      return a.barycenter - b.barycenter;
    }
    if (a.barycenter !== null && b.barycenter === null) return -1;
    if (a.barycenter === null && b.barycenter !== null) return 1;
    if (a.previousOrder !== b.previousOrder) return a.previousOrder - b.previousOrder;
    if (a.originalSpread !== b.originalSpread) return a.originalSpread - b.originalSpread;
    return a.inputIndex - b.inputIndex;
  });

  ranked.forEach((item, index) => {
    ids[index] = item.id;
    nodeStates.get(item.id)!.order = index;
  });
}

// 该函数把逻辑层映射到实际画布坐标；LR/TB/BT 只在此处改变轴向，生产层级语义保持一致。
function assignCoordinates(
  layers: string[][],
  nodeStates: Map<string, LayoutNodeState>,
  direction: LayoutDirection,
  settings: LayoutSettings,
): Map<string, Point> {
  const positions = new Map<string, Point>();
  const maxLayer = layers.length - 1;
  const isHorizontal = direction === 'LR';
  const spreadStep = (isHorizontal ? settings.nodeHeight : settings.nodeWidth) + settings.nodeGap;
  const depthStep = isHorizontal ? settings.horizontalLayerGap : settings.layerGap;

  layers.forEach((ids, layer) => {
    const totalSpread = Math.max(0, (ids.length - 1) * spreadStep);

    ids.forEach((id, index) => {
      const spread = index * spreadStep - totalSpread / 2;
      const depth = direction === 'BT' ? (maxLayer - layer) * depthStep : layer * depthStep;

      if (isHorizontal) {
        positions.set(id, { x: depth, y: spread });
      } else {
        positions.set(id, { x: spread, y: depth });
      }
    });
  });

  return normalizeOrigin(positions, nodeStates);
}

// 该函数把最小 x/y 平移到 0，避免自动布局后出现大面积负坐标，同时不改变节点之间的相对层级。
function normalizeOrigin(
  positions: Map<string, Point>,
  nodeStates: Map<string, LayoutNodeState>,
): Map<string, Point> {
  let minX = Infinity;
  let minY = Infinity;

  for (const position of positions.values()) {
    minX = Math.min(minX, position.x);
    minY = Math.min(minY, position.y);
  }

  const offsetX = Number.isFinite(minX) ? minX : 0;
  const offsetY = Number.isFinite(minY) ? minY : 0;

  for (const state of nodeStates.values()) {
    const position = positions.get(state.id);
    if (!position) continue;
    positions.set(state.id, {
      x: position.x - offsetX,
      y: position.y - offsetY,
    });
  }

  return positions;
}

// 该比较器集中处理稳定顺序：先尊重原画布 spread 位置，再用输入顺序打破完全相同的位置。
function compareByOriginalOrder(a: LayoutNodeState, b: LayoutNodeState): number {
  if (a.originalSpread !== b.originalSpread) return a.originalSpread - b.originalSpread;
  return a.inputIndex - b.inputIndex;
}
