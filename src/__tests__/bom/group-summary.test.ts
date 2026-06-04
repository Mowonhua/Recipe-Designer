import { describe, it, expect, beforeEach } from 'vitest';
import { calculateBom } from '../../bom';
import { buildState, buildNode, buildSlot, buildEdge, buildMachine, resetCounter } from './fixtures';

// Scenario 11: Group summary recipe shortcut
// Note: The current calculator works on individual nodes. Group nodes would need
// special handling at the UI level. For now, we test that the calculator can
// process a BOM where a group acts as a virtual node.
describe('Scenario 11: Group summary recipe shortcut', () => {
  beforeEach(() => resetCounter());

  it('calculates BOM on a node representing a collapsed group', () => {
    resetCounter();
    // Simulate a collapsed group as a single "virtual" node
    // The group has summary_recipe: inputs=[A:2], outputs=[C:3], time=5
    // We model this as a regular node with a single slot
    const machine = buildMachine({ id: 'default-machine', name: 'Default' });
    const rawA = buildNode({ id: 'rawA', name: 'Copper Ore', is_raw_material: true });
    const rawB = buildNode({ id: 'rawB', name: 'Iron Ore', is_raw_material: true });

    // Virtual group node
    const groupSlot = buildSlot({
      id: 'gs1', name: 'Group Recipe', time: 5, machine_id: machine.id,
      primary_output_quantity: 3,
    });
    const groupNode = buildNode({
      id: 'group', name: 'Copper Line', is_raw_material: false,
      slots: [groupSlot], active_slot_id: groupSlot.id,
    });

    const edges = [
      buildEdge({ id: 'e1', source: 'rawA', target: 'group', target_slot_id: groupSlot.id, quantity: 2 }),
      buildEdge({ id: 'e2', source: 'rawB', target: 'group', target_slot_id: groupSlot.id, quantity: 1 }),
    ];

    const state = buildState({ machines: [machine], nodes: [rawA, rawB, groupNode], edges });

    const result = calculateBom(state, {
      nodeId: 'group',
      slotId: groupSlot.id,
      mode: 'one-time',
      targetQuantity: 12,
      balancingStrategy: 'integer-rounding',
      byproductStrategy: 'ignore-annotate',
    });

    // 12/3 = 4 executions
    expect(result.tree.executionCount).toBe(4);
    // rawA: 4*2=8, rawB: 4*1=4
    const rawASummary = result.summary.find(r => r.itemId === 'rawA');
    const rawBSummary = result.summary.find(r => r.itemId === 'rawB');
    expect(rawASummary!.totalQuantity).toBe(8);
    expect(rawBSummary!.totalQuantity).toBe(4);
  });
});
