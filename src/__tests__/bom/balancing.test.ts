import { describe, it, expect, beforeEach } from 'vitest';
import { calculateBom } from '../../bom';
import { buildState, buildNode, buildSlot, buildEdge, buildMachine, resetCounter } from './fixtures';

// Scenario 3: Integer rounding vs exact decimal
describe('Scenario 3: Integer rounding vs exact decimal', () => {
  beforeEach(() => resetCounter());

  it('integer-rounding ceils machine count and marks surplus', () => {
    resetCounter();
    const machine = buildMachine({ id: 'default-machine', name: 'Default', base_speed: 1.0 });
    const raw = buildNode({ id: 'raw', name: 'Raw', is_raw_material: true });
    // time=10s, primary=3 -> output per machine = 3/(10/1) = 0.3/sec = 18/min
    const slot = buildSlot({ id: 's1', name: 'Craft', time: 10, primary_output_quantity: 3, machine_id: machine.id });
    const product = buildNode({ id: 'prod', name: 'Product', is_raw_material: false, slots: [slot], active_slot_id: slot.id });
    const edge = buildEdge({ id: 'e1', source: raw.id, target: product.id, target_slot_id: slot.id, quantity: 1 });

    const state = buildState({ machines: [machine], nodes: [raw, product], edges: [edge] });

    // target 20/min → raw machines = 20/18 = 1.111
    const result = calculateBom(state, {
      nodeId: product.id,
      slotId: slot.id,
      mode: 'continuous',
      targetQuantity: 20, // 20 per minute
      balancingStrategy: 'integer-rounding',
      byproductStrategy: 'ignore-annotate',
    });

    expect(result.tree.machineCount).toBe(2); // ceil(1.111)
    expect(result.tree.isSurplus).toBe(true);
    expect(result.tree.actualOutputRate).toBeCloseTo(36); // 2 * 18
  });

  it('exact-decimal allows fractional machines', () => {
    resetCounter();
    const machine = buildMachine({ id: 'default-machine', name: 'Default', base_speed: 1.0 });
    const raw = buildNode({ id: 'raw', name: 'Raw', is_raw_material: true });
    const slot = buildSlot({ id: 's1', name: 'Craft', time: 10, primary_output_quantity: 3, machine_id: machine.id });
    const product = buildNode({ id: 'prod', name: 'Product', is_raw_material: false, slots: [slot], active_slot_id: slot.id });
    const edge = buildEdge({ id: 'e1', source: raw.id, target: product.id, target_slot_id: slot.id, quantity: 1 });

    const state = buildState({ machines: [machine], nodes: [raw, product], edges: [edge] });

    const result = calculateBom(state, {
      nodeId: product.id,
      slotId: slot.id,
      mode: 'continuous',
      targetQuantity: 20,
      balancingStrategy: 'exact-decimal',
      byproductStrategy: 'ignore-annotate',
    });

    // 20 items/min / 18 items/min per machine = 1.111 machines
    expect(result.tree.machineCount).toBeCloseTo(20 / 18, 3);
    expect(result.tree.isSurplus).toBe(false);
  });
});
