import type { State, ItemNode, RecipeSlot } from '../store';
import type {
  BomRequest, BomResult, BomTreeNode, BomTreeEdge,
  BomByproduct, BomSummaryRow, BomWarning, ByproductStrategy,
} from './types';
import { computeMultipliers } from './multiplier';
import {
  collectByproducts, createByproductAccumulator,
  applyOffsetStrategy, type ByproductAccumulator,
} from './byproduct';
import i18n from '../locales';

function t(key: string, params: Record<string, unknown> = {}): string {
  return i18n.global.t(key, params) as string;
}

const MAX_DEPTH = 50;

export function calculateBom(state: State, request: BomRequest): BomResult {
  const node = state.nodes.find(n => n.id === request.nodeId);
  if (!node) throw new Error(`Node ${request.nodeId} not found`);

  const slot = node.slots.find(s => s.id === request.slotId);
  if (!slot) throw new Error(`Slot ${request.slotId} not found on node ${node.id}`);

  const warnings: BomWarning[] = [];
  const visited = new Set<string>();
  const accumulator = createByproductAccumulator();

  const tree = request.mode === 'one-time'
    ? computeOneTime(state, request, node, slot, visited, warnings, accumulator, 0)
    : computeContinuous(state, request, node, slot, visited, warnings, accumulator, 0);

  if (request.byproductStrategy === 'offset') {
    applyOffsetStrategy(tree, accumulator);
  }

  const summary = buildSummary(tree, request, state);

  return { request, tree, summary, warnings, computedAt: Date.now() };
}

// --- One-time production ---

function computeOneTime(
  state: State,
  request: BomRequest,
  node: ItemNode,
  slot: RecipeSlot,
  visited: Set<string>,
  warnings: BomWarning[],
  accumulator: ByproductAccumulator,
  depth: number,
): BomTreeNode {
  const visitKey = `${node.id}:${slot.id}`;

  if (depth > MAX_DEPTH) {
    warnings.push({ type: 'cycle', nodeId: node.id, message: t('bomWarnings.maxDepth', { maxDepth: MAX_DEPTH, nodeName: node.name }) });
    return makeCycleNode(node, slot, depth);
  }

  if (visited.has(visitKey)) {
    warnings.push({ type: 'cycle', nodeId: node.id, message: t('bomWarnings.cycle', { nodeName: node.name }) });
    return makeCycleNode(node, slot, depth);
  }
  visited.add(visitKey);

  const executionCount = Math.ceil(request.targetQuantity / slot.primary_output_quantity);
  const totalProduced = executionCount * slot.primary_output_quantity;
  const isSurplus = totalProduced > request.targetQuantity;
  const surplusPercent = isSurplus
    ? ((totalProduced - request.targetQuantity) / totalProduced) * 100
    : undefined;

  const isCatalystBlocked = slot.catalyst_mode === 'required' && !slot.catalyst;

  const inputEdges = state.edges.filter(
    e => e.target === node.id && e.target_slot_id === slot.id && e.edge_type === 'input',
  );

  const inputs: BomTreeEdge[] = inputEdges.map(edge => {
    const sourceNode = state.nodes.find(n => n.id === edge.source);
    const sourceQty = executionCount * edge.quantity;

    let child: BomTreeNode | null = null;
    if (sourceNode && !isRawOrAutoRaw(state, sourceNode) && !isCatalystBlocked) {
      const activeSlot = getActiveSlot(sourceNode);
      if (activeSlot) {
        const childRequest: BomRequest = {
          ...request,
          nodeId: sourceNode.id,
          slotId: activeSlot.id,
          targetQuantity: sourceQty,
        };
        child = computeOneTime(state, childRequest, sourceNode, activeSlot, visited, warnings, accumulator, depth + 1);
      }
    }

    return {
      edgeId: edge.id,
      sourceNodeId: edge.source,
      sourceNodeName: sourceNode?.name || edge.source,
      sourceNodeColor: sourceNode?.color || '#64748b',
      quantity: sourceQty,
      child,
    };
  });

  const byproducts = isCatalystBlocked
    ? []
    : collectByproducts(state, slot, executionCount, request.byproductStrategy, accumulator);

  if (request.byproductStrategy === 'independent-output') {
    for (const bp of byproducts) {
      const bpNode = state.nodes.find(n => n.id === bp.itemId);
      if (bpNode) {
        const bpSlot = getActiveSlot(bpNode);
        if (bpSlot && !isRawOrAutoRaw(state, bpNode)) {
          const bpRequest: BomRequest = {
            ...request,
            nodeId: bpNode.id,
            slotId: bpSlot.id,
            targetQuantity: bp.quantity,
          };
          const bpChild = computeOneTime(state, bpRequest, bpNode, bpSlot, visited, warnings, accumulator, depth + 1);
          inputs.push({
            edgeId: `byproduct-${bp.itemId}`,
            sourceNodeId: bpNode.id,
            sourceNodeName: bp.itemName,
            sourceNodeColor: bp.itemColor,
            quantity: bp.quantity,
            child: { ...bpChild, isByproduct: true },
          });
        } else {
          // Raw/byproduct item - add as leaf edge
          inputs.push({
            edgeId: `byproduct-${bp.itemId}`,
            sourceNodeId: bpNode.id,
            sourceNodeName: bp.itemName,
            sourceNodeColor: bp.itemColor,
            quantity: bp.quantity,
            child: null,
          });
        }
      }
    }
  }

  if (isCatalystBlocked) {
    warnings.push({ type: 'catalyst_missing', nodeId: node.id, message: t('bomWarnings.catalystMissing', { slotName: slot.name, nodeName: node.name }) });
  }

  visited.delete(visitKey);

  return {
    nodeId: node.id,
    nodeName: node.name,
    nodeColor: node.color || '#64748b',
    slotId: slot.id,
    slotName: slot.name,
    depth,
    executionCount,
    targetQuantity: request.targetQuantity,
    inputs,
    byproducts,
    isRawMaterial: false,
    isByproduct: false,
    isSurplus,
    surplusPercent,
    isCatalystBlocked,
    isCycleDetected: false,
  };
}

// --- Continuous production ---

function computeContinuous(
  state: State,
  request: BomRequest,
  node: ItemNode,
  slot: RecipeSlot,
  visited: Set<string>,
  warnings: BomWarning[],
  accumulator: ByproductAccumulator,
  depth: number,
): BomTreeNode {
  const visitKey = `${node.id}:${slot.id}`;

  if (depth > MAX_DEPTH) {
    warnings.push({ type: 'cycle', nodeId: node.id, message: t('bomWarnings.maxDepth', { maxDepth: MAX_DEPTH, nodeName: node.name }) });
    return makeCycleNode(node, slot, depth);
  }

  if (visited.has(visitKey)) {
    warnings.push({ type: 'cycle', nodeId: node.id, message: t('bomWarnings.cycle', { nodeName: node.name }) });
    return makeCycleNode(node, slot, depth);
  }
  visited.add(visitKey);

  const { yieldMultiplier, speedMultiplier } = computeMultipliers(state, slot);

  // All quantities in items/second internally; targetQuantity is items/minute from user
  const targetRatePerSec = request.targetQuantity / 60;

  const actualOutputPerCycle = slot.primary_output_quantity * yieldMultiplier;
  const actualTimePerCycleSec = slot.time / speedMultiplier;
  const outputRatePerSec = actualOutputPerCycle / actualTimePerCycleSec;

  const rawMachineCount = targetRatePerSec / outputRatePerSec;
  const machineCount = request.balancingStrategy === 'integer-rounding'
    ? Math.ceil(rawMachineCount)
    : rawMachineCount;

  const actualOutputRatePerSec = machineCount * outputRatePerSec;
  const actualOutputRatePerMin = actualOutputRatePerSec * 60;
  const isSurplus = actualOutputRatePerMin > request.targetQuantity + 0.001;
  const surplusPercent = isSurplus
    ? ((actualOutputRatePerMin - request.targetQuantity) / actualOutputRatePerMin) * 100
    : undefined;

  const isCatalystBlocked = slot.catalyst_mode === 'required' && !slot.catalyst;

  const inputEdges = state.edges.filter(
    e => e.target === node.id && e.target_slot_id === slot.id && e.edge_type === 'input',
  );

  const inputs: BomTreeEdge[] = inputEdges.map(edge => {
    const sourceNode = state.nodes.find(n => n.id === edge.source);
    // Consumption rate in items/min
    const consumptionRatePerMin = (machineCount * edge.quantity / actualTimePerCycleSec) * 60;
    const consumptionRatePerSec = consumptionRatePerMin / 60;

    let child: BomTreeNode | null = null;
    if (sourceNode && !isRawOrAutoRaw(state, sourceNode) && !isCatalystBlocked) {
      const activeSlot = getActiveSlot(sourceNode);
      if (activeSlot) {
        const childRequest: BomRequest = {
          ...request,
          nodeId: sourceNode.id,
          slotId: activeSlot.id,
          targetQuantity: consumptionRatePerMin, // pass as items/min
        };
        child = computeContinuous(state, childRequest, sourceNode, activeSlot, visited, warnings, accumulator, depth + 1);
      }
    }

    return {
      edgeId: edge.id,
      sourceNodeId: edge.source,
      sourceNodeName: sourceNode?.name || edge.source,
      sourceNodeColor: sourceNode?.color || '#64748b',
      quantity: consumptionRatePerMin, // items/min
      child,
    };
  });

  // Byproducts: cycles per minute
  const cyclesPerMin = (machineCount / actualTimePerCycleSec) * 60;
  const byproducts = isCatalystBlocked
    ? []
    : collectByproductsContinuous(state, slot, cyclesPerMin, request.byproductStrategy, accumulator);

  if (isCatalystBlocked) {
    warnings.push({ type: 'catalyst_missing', nodeId: node.id, message: t('bomWarnings.catalystMissing', { slotName: slot.name, nodeName: node.name }) });
  }

  visited.delete(visitKey);

  return {
    nodeId: node.id,
    nodeName: node.name,
    nodeColor: node.color || '#64748b',
    slotId: slot.id,
    slotName: slot.name,
    depth,
    machineCount,
    actualOutputRate: actualOutputRatePerMin, // items/min
    targetQuantity: request.targetQuantity,
    inputs,
    byproducts,
    isRawMaterial: false,
    isByproduct: false,
    isSurplus,
    surplusPercent,
    isCatalystBlocked,
    isCycleDetected: false,
  };
}

// --- Summary builder ---

function buildSummary(tree: BomTreeNode, request: BomRequest, state: State): BomSummaryRow[] {
  const map = new Map<string, BomSummaryRow>();
  collectSummary(tree, request, map, state);
  return Array.from(map.values());
}

function collectSummary(node: BomTreeNode, request: BomRequest, map: Map<string, BomSummaryRow>, state: State): void {
  if (node.isCycleDetected) return;

  // Add this node to summary
  addNodeToSummary(node, request, map);

  // Recurse into children
  for (const edge of node.inputs) {
    if (edge.child) {
      collectSummary(edge.child, request, map, state);
    } else {
      // Raw material leaf: add from edge info
      const rawNode = state.nodes.find(n => n.id === edge.sourceNodeId);
      const existing = map.get(edge.sourceNodeId);
      if (existing) {
        if (request.mode === 'one-time') {
          existing.totalQuantity = (existing.totalQuantity || 0) + edge.quantity;
        } else {
          existing.totalRate = (existing.totalRate || 0) + edge.quantity;
        }
      } else {
        map.set(edge.sourceNodeId, {
          itemId: edge.sourceNodeId,
          itemName: edge.sourceNodeName,
          itemColor: edge.sourceNodeColor,
          totalQuantity: request.mode === 'one-time' ? edge.quantity : undefined,
          totalRate: request.mode === 'continuous' ? edge.quantity : undefined,
          isRawMaterial: true,
          isByproduct: false,
          isSurplus: false,
        });
      }
    }

  }

  // Collect byproducts from this node
  for (const bp of node.byproducts) {
    addByproductToSummary(bp, request, map);
  }
}

function addNodeToSummary(node: BomTreeNode, request: BomRequest, map: Map<string, BomSummaryRow>): void {
  const existing = map.get(node.nodeId);
  if (existing) {
    if (request.mode === 'one-time') {
      existing.totalQuantity = (existing.totalQuantity || 0) + node.targetQuantity;
    }
    if (request.mode === 'continuous' && node.actualOutputRate !== undefined) {
      existing.totalRate = (existing.totalRate || 0) + node.actualOutputRate;
    }
    if (request.mode === 'continuous' && node.machineCount !== undefined) {
      existing.totalMachines = (existing.totalMachines || 0) + node.machineCount;
    }
    if (node.isSurplus) existing.isSurplus = true;
  } else {
    map.set(node.nodeId, {
      itemId: node.nodeId,
      itemName: node.nodeName,
      itemColor: node.nodeColor,
      totalQuantity: request.mode === 'one-time' ? node.targetQuantity : undefined,
      totalRate: request.mode === 'continuous' ? node.actualOutputRate : undefined,
      totalMachines: request.mode === 'continuous' ? node.machineCount : undefined,
      isRawMaterial: node.isRawMaterial,
      isByproduct: node.isByproduct,
      isSurplus: node.isSurplus,
      surplusPercent: node.surplusPercent,
    });
  }
}

function addByproductToSummary(bp: BomByproduct, request: BomRequest, map: Map<string, BomSummaryRow>): void {
  const existing = map.get(bp.itemId);
  if (existing) {
    if (request.mode === 'one-time') {
      existing.totalQuantity = (existing.totalQuantity || 0) + bp.quantity;
    } else {
      existing.totalRate = (existing.totalRate || 0) + bp.quantity;
    }
  } else {
    map.set(bp.itemId, {
      itemId: bp.itemId,
      itemName: bp.itemName,
      itemColor: bp.itemColor,
      totalQuantity: request.mode === 'one-time' ? bp.quantity : undefined,
      totalRate: request.mode === 'continuous' ? bp.quantity : undefined,
      isRawMaterial: false,
      isByproduct: true,
      isSurplus: false,
    });
  }
}

// --- Helpers ---

function makeCycleNode(node: ItemNode, slot: RecipeSlot, depth: number): BomTreeNode {
  return {
    nodeId: node.id,
    nodeName: node.name,
    nodeColor: node.color || '#64748b',
    slotId: slot.id,
    slotName: slot.name,
    depth,
    targetQuantity: 0,
    inputs: [],
    byproducts: [],
    isRawMaterial: false,
    isByproduct: false,
    isSurplus: false,
    isCatalystBlocked: false,
    isCycleDetected: true,
  };
}

function isRawOrAutoRaw(state: State, node: ItemNode): boolean {
  if (node.is_raw_material === true) return true;
  if (node.is_raw_material === null) {
    const hasIncoming = state.edges.some(
      e => e.target === node.id && e.edge_type === 'input',
    );
    return !hasIncoming;
  }
  return false;
}

function getActiveSlot(node: ItemNode): RecipeSlot | undefined {
  if (node.active_slot_id) {
    return node.slots.find(s => s.id === node.active_slot_id);
  }
  return node.slots[0];
}

function collectByproductsContinuous(
  state: State,
  slot: RecipeSlot,
  cyclesPerMin: number,
  strategy: ByproductStrategy,
  accumulator: ByproductAccumulator,
): BomByproduct[] {
  const byproducts: BomByproduct[] = [];

  for (const so of slot.secondary_outputs) {
    const node = state.nodes.find(n => n.id === so.item_id);
    const quantity = so.quantity * cyclesPerMin;

    const bp: BomByproduct = {
      itemId: so.item_id,
      itemName: node?.name || so.item_id,
      itemColor: node?.color || '#64748b',
      quantity,
    };

    if (strategy === 'offset') {
      accumulator.available.set(
        so.item_id,
        (accumulator.available.get(so.item_id) || 0) + quantity,
      );
    }

    byproducts.push(bp);
  }

  return byproducts;
}
