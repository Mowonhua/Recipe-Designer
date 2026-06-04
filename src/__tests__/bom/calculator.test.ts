import { describe, it, expect, beforeEach } from 'vitest';
import { calculateBom } from '../../bom';
import { buildState, buildNode, buildSlot, buildEdge, buildMachine, resetCounter, buildSimpleChain } from './fixtures';

// Scenario 1: Basic one-time production
describe('Scenario 1: Basic one-time production', () => {
  beforeEach(() => resetCounter());

  it('computes execution count and raw material needs for a single chain', () => {
    const { state, targetId, targetSlotId } = buildSimpleChain();

    const result = calculateBom(state, {
      nodeId: targetId,
      slotId: targetSlotId,
      mode: 'one-time',
      targetQuantity: 10,
      balancingStrategy: 'integer-rounding',
      byproductStrategy: 'ignore-annotate',
    });

    expect(result.tree.nodeId).toBe(targetId);
    expect(result.tree.executionCount).toBe(10);
    expect(result.tree.isSurplus).toBe(false);
    expect(result.tree.inputs).toHaveLength(1);
    expect(result.tree.inputs[0].quantity).toBe(20); // 10 * 2 (edge qty)
    expect(result.tree.inputs[0].child).toBeTruthy();
    expect(result.tree.inputs[0].child!.nodeId).toBe('mid');
    expect(result.tree.inputs[0].child!.executionCount).toBe(20);
    expect(result.tree.inputs[0].child!.inputs).toHaveLength(1);
    expect(result.tree.inputs[0].child!.inputs[0].quantity).toBe(20);
    expect(result.tree.inputs[0].child!.inputs[0].child).toBeNull(); // raw material
  });

  it('handles primary_output_quantity > 1 with ceiling logic', () => {
    resetCounter();
    const machine = buildMachine({ id: 'default-machine', name: 'Default' });
    const raw = buildNode({ id: 'raw', name: 'Raw', is_raw_material: true });
    const slot = buildSlot({ id: 's1', name: 'Produce 3', primary_output_quantity: 3, machine_id: machine.id });
    const product = buildNode({ id: 'prod', name: 'Product', is_raw_material: false, slots: [slot], active_slot_id: slot.id });
    const edge = buildEdge({ id: 'e1', source: raw.id, target: product.id, target_slot_id: slot.id, quantity: 2 });

    const state = buildState({ machines: [machine], nodes: [raw, product], edges: [edge] });

    const result = calculateBom(state, {
      nodeId: product.id,
      slotId: slot.id,
      mode: 'one-time',
      targetQuantity: 10,
      balancingStrategy: 'integer-rounding',
      byproductStrategy: 'ignore-annotate',
    });

    // ceil(10/3) = 4 executions, 4*3=12 produced
    expect(result.tree.executionCount).toBe(4);
    expect(result.tree.isSurplus).toBe(true);
    // surplus = (12-10)/12 = 16.67%
    expect(result.tree.surplusPercent).toBeCloseTo(16.67, 0);
    // 4 * 2 = 8 raw needed
    expect(result.tree.inputs[0].quantity).toBe(8);
  });
});

// Scenario 2: Continuous production throughput
describe('Scenario 2: Continuous production throughput', () => {
  beforeEach(() => resetCounter());

  it('computes machine count and consumption rates', () => {
    resetCounter();
    const machine = buildMachine({ id: 'default-machine', name: 'Default', base_speed: 1.0 });
    const raw = buildNode({ id: 'raw', name: 'Raw', is_raw_material: true });
    // time=2s means 0.5 items/sec per machine = 30 items/min per machine
    const slot = buildSlot({ id: 's1', name: 'Craft', time: 2, primary_output_quantity: 1, machine_id: machine.id });
    const product = buildNode({ id: 'prod', name: 'Product', is_raw_material: false, slots: [slot], active_slot_id: slot.id });
    const edge = buildEdge({ id: 'e1', source: raw.id, target: product.id, target_slot_id: slot.id, quantity: 3 });

    const state = buildState({ machines: [machine], nodes: [raw, product], edges: [edge] });

    // Target: 30 items/min
    const result = calculateBom(state, {
      nodeId: product.id,
      slotId: slot.id,
      mode: 'continuous',
      targetQuantity: 30, // 30 items/min
      balancingStrategy: 'integer-rounding',
      byproductStrategy: 'ignore-annotate',
    });

    // output rate per machine = 1/(2/1) = 0.5/sec = 30/min
    // machine count = ceil(30/30) = 1
    expect(result.tree.machineCount).toBe(1);
    // consumption = 1 * 3 / 2s * 60 = 90 items/min
    expect(result.tree.inputs[0].quantity).toBeCloseTo(90, 0);
  });

  it('applies machine base_speed to throughput', () => {
    resetCounter();
    const machine = buildMachine({ id: 'default-machine', name: 'Fast', base_speed: 2.0 });
    const raw = buildNode({ id: 'raw', name: 'Raw', is_raw_material: true });
    // time=2s, base_speed=2.0 -> effective time = 2/2 = 1s -> 1 item/sec = 60/min
    const slot = buildSlot({ id: 's1', name: 'Craft', time: 2, primary_output_quantity: 1, machine_id: machine.id });
    const product = buildNode({ id: 'prod', name: 'Product', is_raw_material: false, slots: [slot], active_slot_id: slot.id });
    const edge = buildEdge({ id: 'e1', source: raw.id, target: product.id, target_slot_id: slot.id, quantity: 1 });

    const state = buildState({ machines: [machine], nodes: [raw, product], edges: [edge] });

    const result = calculateBom(state, {
      nodeId: product.id,
      slotId: slot.id,
      mode: 'continuous',
      targetQuantity: 60, // 60 items/min
      balancingStrategy: 'integer-rounding',
      byproductStrategy: 'ignore-annotate',
    });

    // speed = 2.0, effective time = 2/2 = 1s
    // output rate per machine = 1/1 = 1/sec = 60/min
    // machines = ceil(60/60) = 1
    expect(result.tree.machineCount).toBe(1);
  });
});

// Scenario 6: Multi-slot node switching
describe('Scenario 6: Multi-slot node switching', () => {
  beforeEach(() => resetCounter());

  it('uses only active slot inputs for calculation', () => {
    resetCounter();
    const machine = buildMachine({ id: 'default-machine', name: 'Default' });
    const rawA = buildNode({ id: 'rawA', name: 'Raw A', is_raw_material: true });
    const rawB = buildNode({ id: 'rawB', name: 'Raw B', is_raw_material: true });
    const slot1 = buildSlot({ id: 's1', name: 'Recipe A', time: 2, machine_id: machine.id });
    const slot2 = buildSlot({ id: 's2', name: 'Recipe B', time: 3, machine_id: machine.id });
    const product = buildNode({
      id: 'prod', name: 'Product', is_raw_material: false,
      slots: [slot1, slot2], active_slot_id: slot2.id,
    });
    const edgeA = buildEdge({ id: 'eA', source: rawA.id, target: product.id, target_slot_id: slot1.id, quantity: 2 });
    const edgeB = buildEdge({ id: 'eB', source: rawB.id, target: product.id, target_slot_id: slot2.id, quantity: 1 });

    const state = buildState({ machines: [machine], nodes: [rawA, rawB, product], edges: [edgeA, edgeB] });

    const result = calculateBom(state, {
      nodeId: product.id,
      slotId: slot2.id,
      mode: 'one-time',
      targetQuantity: 5,
      balancingStrategy: 'integer-rounding',
      byproductStrategy: 'ignore-annotate',
    });

    expect(result.tree.inputs).toHaveLength(1);
    expect(result.tree.inputs[0].sourceNodeId).toBe(rawB.id);
    expect(result.tree.inputs[0].quantity).toBe(5);
  });
});

// Scenario 7: Catalyst required
describe('Scenario 7: Catalyst required', () => {
  beforeEach(() => resetCounter());

  it('marks recipe unusable when required catalyst is missing', () => {
    resetCounter();
    const machine = buildMachine({ id: 'default-machine', name: 'Default' });
    const raw = buildNode({ id: 'raw', name: 'Raw', is_raw_material: true });
    const slot = buildSlot({
      id: 's1', name: 'Catalyst Recipe', time: 2, machine_id: machine.id,
      catalyst_mode: 'required', catalyst: undefined,
    });
    const product = buildNode({ id: 'prod', name: 'Product', is_raw_material: false, slots: [slot], active_slot_id: slot.id });
    const edge = buildEdge({ id: 'e1', source: raw.id, target: product.id, target_slot_id: slot.id, quantity: 1 });

    const state = buildState({ machines: [machine], nodes: [raw, product], edges: [edge] });

    const result = calculateBom(state, {
      nodeId: product.id,
      slotId: slot.id,
      mode: 'one-time',
      targetQuantity: 10,
      balancingStrategy: 'integer-rounding',
      byproductStrategy: 'ignore-annotate',
    });

    expect(result.tree.isCatalystBlocked).toBe(true);
    // Inputs still listed but children not recursed
    expect(result.tree.inputs).toHaveLength(1);
    expect(result.tree.inputs[0].child).toBeNull(); // not recursed
    expect(result.warnings.some(w => w.type === 'catalyst_missing')).toBe(true);
  });

  it('proceeds normally when required catalyst is present', () => {
    resetCounter();
    const machine = buildMachine({ id: 'default-machine', name: 'Default' });
    const raw = buildNode({ id: 'raw', name: 'Raw', is_raw_material: true });
    const catalystItem = buildNode({ id: 'cat', name: 'Catalyst Item', is_raw_material: true });
    const slot = buildSlot({
      id: 's1', name: 'Catalyst Recipe', time: 2, machine_id: machine.id,
      catalyst_mode: 'required', catalyst: { item_id: catalystItem.id, quantity: 1 },
    });
    const product = buildNode({ id: 'prod', name: 'Product', is_raw_material: false, slots: [slot], active_slot_id: slot.id });
    const edge = buildEdge({ id: 'e1', source: raw.id, target: product.id, target_slot_id: slot.id, quantity: 1 });

    const state = buildState({ machines: [machine], nodes: [raw, catalystItem, product], edges: [edge] });

    const result = calculateBom(state, {
      nodeId: product.id,
      slotId: slot.id,
      mode: 'one-time',
      targetQuantity: 10,
      balancingStrategy: 'integer-rounding',
      byproductStrategy: 'ignore-annotate',
    });

    expect(result.tree.isCatalystBlocked).toBe(false);
    expect(result.tree.inputs).toHaveLength(1);
  });
});

// Scenario 8: Catalyst optional with speed_multiplier
describe('Scenario 8: Catalyst optional', () => {
  beforeEach(() => resetCounter());

  it('applies speed_multiplier when optional catalyst is present', () => {
    resetCounter();
    const machine = buildMachine({ id: 'default-machine', name: 'Default', base_speed: 1.0 });
    const raw = buildNode({ id: 'raw', name: 'Raw', is_raw_material: true });
    // time=4s, catalyst speed_multiplier=2.0 -> effective time = 4/(1*2) = 2s
    // output rate = 1/2s = 0.5/sec = 30/min
    const slot = buildSlot({
      id: 's1', name: 'Catalyst Recipe', time: 4, machine_id: machine.id,
      catalyst_mode: 'optional',
      catalyst: { item_id: 'cat-item', quantity: 1, speed_multiplier: 2.0 },
    });
    const product = buildNode({ id: 'prod', name: 'Product', is_raw_material: false, slots: [slot], active_slot_id: slot.id });
    const edge = buildEdge({ id: 'e1', source: raw.id, target: product.id, target_slot_id: slot.id, quantity: 1 });

    const state = buildState({ machines: [machine], nodes: [raw, product], edges: [edge] });

    const result = calculateBom(state, {
      nodeId: product.id,
      slotId: slot.id,
      mode: 'continuous',
      targetQuantity: 30, // 30 items/min
      balancingStrategy: 'integer-rounding',
      byproductStrategy: 'ignore-annotate',
    });

    // speed = 1.0 * 2.0 = 2.0
    // effective time = 4/2 = 2s
    // output rate per machine = 1/2 = 0.5/sec = 30/min
    // machine count = ceil(30/30) = 1
    expect(result.tree.machineCount).toBe(1);
  });
});

describe('Phase 3.6: proliferator assignments', () => {
  beforeEach(() => resetCounter());

  it('applies assigned proliferator yield and includes proliferator consumption in continuous BOM summary', () => {
    const machine = buildMachine({ id: 'assembler', name: 'Assembler', base_speed: 1.0 });
    const raw = buildNode({ id: 'raw', name: 'Raw', is_raw_material: true });
    const spray = buildNode({ id: 'spray', name: 'Spray', is_raw_material: true });
    const slot = buildSlot({
      id: 's1',
      name: 'Craft',
      time: 2,
      machine_id: machine.id,
      primary_output_quantity: 1,
    });
    const product = buildNode({
      id: 'prod',
      name: 'Product',
      is_raw_material: false,
      slots: [slot],
      active_slot_id: slot.id,
    });
    const edge = buildEdge({ id: 'e1', source: raw.id, target: product.id, target_slot_id: slot.id, quantity: 1 });
    const state = buildState({
      machines: [machine],
      nodes: [raw, spray, product],
      edges: [edge],
      proliferators: [
        { id: 'prolif-1', item_id: spray.id, multiplier: 2, consumption_per_cycle: 1 },
      ],
    });

    const result = calculateBom(state, {
      nodeId: product.id,
      slotId: slot.id,
      mode: 'continuous',
      targetQuantity: 60,
      balancingStrategy: 'exact-decimal',
      byproductStrategy: 'ignore-annotate',
      proliferatorAssignments: { [machine.id]: 'prolif-1' },
    });

    expect(result.tree.machineCount).toBeCloseTo(1);
    const sprayRow = result.summary.find(row => row.itemId === spray.id);
    expect(sprayRow?.totalRate).toBeCloseTo(30);
    expect(sprayRow?.isProliferator).toBe(true);
  });
});
