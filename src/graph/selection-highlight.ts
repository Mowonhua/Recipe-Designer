export interface SelectionHighlight {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
}

export interface HighlightEdgeEndpoint {
  id: string;
  source: string;
  target: string;
}

// 该函数根据当前选中节点收集一跳范围内的关联节点和连线。
// 数据流只读取带有 source/target 的边端点列表：命中 source 或 target 的边会进入高亮边集合，另一端节点进入高亮节点集合。
// 未传入选中节点时返回空集合，使调用方可以用集合是否为空判断画布是否处于选中高亮态。
export function collectSelectionHighlight(
  selectedNodeId: string | null | undefined,
  edges: readonly HighlightEdgeEndpoint[],
): SelectionHighlight {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  if (!selectedNodeId) {
    return { nodeIds, edgeIds };
  }

  nodeIds.add(selectedNodeId);

  for (const edge of edges) {
    const isIncoming = edge.target === selectedNodeId;
    const isOutgoing = edge.source === selectedNodeId;

    if (!isIncoming && !isOutgoing) continue;

    edgeIds.add(edge.id);
    nodeIds.add(isIncoming ? edge.source : edge.target);
  }

  return { nodeIds, edgeIds };
}
