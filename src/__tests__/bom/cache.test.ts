import { describe, it, expect, beforeEach } from 'vitest';
import { BomCache, calculateBom } from '../../bom';
import { buildState, buildNode, buildSlot, buildEdge, buildMachine, resetCounter, buildSimpleChain } from './fixtures';

// Scenario 13: Incremental cache dirty propagation
describe('Scenario 13: Incremental cache dirty propagation', () => {
  let cache: BomCache;

  beforeEach(() => {
    resetCounter();
    cache = new BomCache();
  });

  it('returns cached result on identical request and unchanged state', () => {
    const { state, targetId, targetSlotId } = buildSimpleChain();

    const request = {
      nodeId: targetId, slotId: targetSlotId,
      mode: 'one-time' as const, targetQuantity: 10,
      balancingStrategy: 'integer-rounding' as const,
      byproductStrategy: 'ignore-annotate' as const,
    };

    const result = calculateBom(state, request);
    cache.set(request, result, state);

    const cached = cache.get(request, state);
    expect(cached).toBeTruthy();
    expect(cached!.tree.nodeId).toBe(targetId);
  });

  it('invalidates when slot config changes', () => {
    const { state, targetId, targetSlotId } = buildSimpleChain();
    const targetNode = state.nodes.find(n => n.id === targetId)!;
    const slot = targetNode.slots.find(s => s.id === targetSlotId)!;

    const request = {
      nodeId: targetId, slotId: targetSlotId,
      mode: 'one-time' as const, targetQuantity: 10,
      balancingStrategy: 'integer-rounding' as const,
      byproductStrategy: 'ignore-annotate' as const,
    };

    const result = calculateBom(state, request);
    cache.set(request, result, state);

    slot.time = 99;
    const cached = cache.get(request, state);
    expect(cached).toBeNull();
  });

  it('invalidates when incoming edge quantity changes', () => {
    const { state, targetId, targetSlotId } = buildSimpleChain();

    const request = {
      nodeId: targetId, slotId: targetSlotId,
      mode: 'one-time' as const, targetQuantity: 10,
      balancingStrategy: 'integer-rounding' as const,
      byproductStrategy: 'ignore-annotate' as const,
    };

    const result = calculateBom(state, request);
    cache.set(request, result, state);

    // Change the edge targeting the target node (e2: mid -> target)
    const edgeToTarget = state.edges.find(e => e.target === targetId)!;
    edgeToTarget.quantity = 5;
    const cached = cache.get(request, state);
    expect(cached).toBeNull();
  });

  it('LRU evicts oldest entry at 500 limit', () => {
    const machine = buildMachine({ id: 'default-machine', name: 'Default' });
    const raw = buildNode({ id: 'raw', name: 'Raw', is_raw_material: true });
    const slot = buildSlot({ id: 's1', name: 'Craft', time: 1, machine_id: machine.id });
    const product = buildNode({ id: 'prod', name: 'Product', is_raw_material: false, slots: [slot], active_slot_id: slot.id });
    const edge = buildEdge({ id: 'e1', source: 'raw', target: 'prod', target_slot_id: slot.id, quantity: 1 });
    const state = buildState({ machines: [machine], nodes: [raw, product], edges: [edge] });

    for (let i = 1; i <= 501; i++) {
      const request = {
        nodeId: 'prod', slotId: 's1',
        mode: 'one-time' as const, targetQuantity: i,
        balancingStrategy: 'integer-rounding' as const,
        byproductStrategy: 'ignore-annotate' as const,
      };
      const result = calculateBom(state, request);
      cache.set(request, result, state);
    }

    expect(cache.size).toBe(500);
  });

  it('invalidate(nodeId) removes only entries for that node', () => {
    const machine = buildMachine({ id: 'default-machine', name: 'Default' });
    const raw = buildNode({ id: 'raw', name: 'Raw', is_raw_material: true });
    const slotA = buildSlot({ id: 'sA', name: 'A', time: 1, machine_id: machine.id });
    const slotB = buildSlot({ id: 'sB', name: 'B', time: 2, machine_id: machine.id });
    const nodeA = buildNode({ id: 'nA', name: 'A', is_raw_material: false, slots: [slotA], active_slot_id: slotA.id });
    const nodeB = buildNode({ id: 'nB', name: 'B', is_raw_material: false, slots: [slotB], active_slot_id: slotB.id });
    const edgeA = buildEdge({ id: 'eA', source: 'raw', target: 'nA', target_slot_id: slotA.id, quantity: 1 });
    const edgeB = buildEdge({ id: 'eB', source: 'raw', target: 'nB', target_slot_id: slotB.id, quantity: 1 });
    const state = buildState({ machines: [machine], nodes: [raw, nodeA, nodeB], edges: [edgeA, edgeB] });

    const reqA = {
      nodeId: 'nA', slotId: 'sA', mode: 'one-time' as const, targetQuantity: 5,
      balancingStrategy: 'integer-rounding' as const, byproductStrategy: 'ignore-annotate' as const,
    };
    const reqB = {
      nodeId: 'nB', slotId: 'sB', mode: 'one-time' as const, targetQuantity: 5,
      balancingStrategy: 'integer-rounding' as const, byproductStrategy: 'ignore-annotate' as const,
    };

    cache.set(reqA, calculateBom(state, reqA), state);
    cache.set(reqB, calculateBom(state, reqB), state);

    expect(cache.size).toBe(2);

    cache.invalidate('nA');
    expect(cache.get(reqA, state)).toBeNull();
    expect(cache.get(reqB, state)).toBeTruthy();
  });
});
