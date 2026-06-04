import { describe, it, expect, beforeEach } from 'vitest';
import { calculateBom } from '../../bom';
import { buildState, buildNode, buildSlot, buildEdge, buildMachine, resetCounter, buildDiamondGraph } from './fixtures';

// Scenario 5: Multi-ingredient aggregation
describe('Scenario 5: Multi-ingredient aggregation', () => {
  beforeEach(() => resetCounter());

  it('aggregates same item from multiple branches in one-time mode', () => {
    resetCounter();
    const machine = buildMachine({ id: 'default-machine', name: 'Default' });
    const raw = buildNode({ id: 'raw', name: 'Iron Ore', is_raw_material: true });

    // raw -> A (needs 2 raw) -> C (needs 1 A and 2 raw)
    const slotA = buildSlot({ id: 'sA', name: 'Make A', time: 2, machine_id: machine.id });
    const nodeA = buildNode({ id: 'A', name: 'Iron Ingot', is_raw_material: false, slots: [slotA], active_slot_id: slotA.id });

    const slotC = buildSlot({ id: 'sC', name: 'Make C', time: 3, machine_id: machine.id, primary_output_quantity: 1 });
    const nodeC = buildNode({ id: 'C', name: 'Iron Plate', is_raw_material: false, slots: [slotC], active_slot_id: slotC.id });

    const edges = [
      buildEdge({ id: 'e1', source: 'raw', target: 'A', target_slot_id: slotA.id, quantity: 2 }),
      buildEdge({ id: 'e2', source: 'A', target: 'C', target_slot_id: slotC.id, quantity: 1 }),
      buildEdge({ id: 'e3', source: 'raw', target: 'C', target_slot_id: slotC.id, quantity: 1 }),
    ];

    const state = buildState({ machines: [machine], nodes: [raw, nodeA, nodeC], edges });

    const result = calculateBom(state, {
      nodeId: 'C',
      slotId: slotC.id,
      mode: 'one-time',
      targetQuantity: 5,
      balancingStrategy: 'integer-rounding',
      byproductStrategy: 'ignore-annotate',
    });

    // C needs: 1*A + 1*raw per execution, 5 executions
    // A needs: 2*raw per execution
    // Direct raw: 5*1 = 5
    // A's raw: 5*2 = 10
    // Total raw = 15

    const summary = result.summary;
    const rawRow = summary.find(r => r.itemId === 'raw');
    expect(rawRow).toBeTruthy();
    expect(rawRow!.totalQuantity).toBe(15); // 5 direct + 10 through A

    const aRow = summary.find(r => r.itemId === 'A');
    expect(aRow).toBeTruthy();
  });

  it('aggregates same item from different input edges in diamond graph', () => {
    const { state, targetId, targetSlotId } = buildDiamondGraph();

    const result = calculateBom(state, {
      nodeId: targetId,
      slotId: targetSlotId,
      mode: 'one-time',
      targetQuantity: 3,
      balancingStrategy: 'integer-rounding',
      byproductStrategy: 'ignore-annotate',
    });

    // target needs 3*3=9 rawA and 3*2=6 rawB
    const summary = result.summary;
    const rawARow = summary.find(r => r.itemId === 'rawA');
    const rawBRow = summary.find(r => r.itemId === 'rawB');
    expect(rawARow!.totalQuantity).toBe(9);
    expect(rawBRow!.totalQuantity).toBe(6);
  });
});
