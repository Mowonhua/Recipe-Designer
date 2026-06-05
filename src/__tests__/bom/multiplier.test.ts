import { describe, it, expect, beforeEach } from 'vitest';
import { calculateBom, computeMultipliers } from '../../bom';
import { buildState, buildNode, buildSlot, buildEdge, buildMachine, buildEffect, resetCounter } from './fixtures';

// Scenario 9: Machine boost x global effect multiplication
describe('Scenario 9: Machine boost × global effect multiplication', () => {
  beforeEach(() => resetCounter());

  it('applies recipe_yield global effect additively, then multiplies with speed', () => {
    resetCounter();
    const machine = buildMachine({ id: 'default-machine', name: 'Furnace', base_speed: 1.0, tags: ['thermal'] });
    const raw = buildNode({ id: 'raw', name: 'Ore', is_raw_material: true });
    const slot = buildSlot({
      id: 's1', name: 'Smelting', time: 4, machine_id: machine.id,
      tags: ['smelting'], primary_output_quantity: 1,
    });
    const product = buildNode({
      id: 'prod', name: 'Ingot', is_raw_material: false,
      slots: [slot], active_slot_id: slot.id,
    });
    const edge = buildEdge({ id: 'e1', source: 'raw', target: 'prod', target_slot_id: slot.id, quantity: 1 });

    const effect1 = buildEffect({ id: 'eff1', name: 'Skill 1', type: 'recipe_yield', target_tags: ['smelting'], multiplier: 1.5 });
    const effect2 = buildEffect({ id: 'eff2', name: 'Skill 2', type: 'recipe_yield', target_tags: ['thermal'], multiplier: 1.2 });

    const state = buildState({
      machines: [machine], nodes: [raw, product], edges: [edge],
      global_effects: [effect1, effect2],
    });

    // recipe_yield additive: 1 + (1.5-1) + (1.2-1) = 1.7
    const muls = computeMultipliers(state, slot);
    expect(muls.yieldMultiplier).toBeCloseTo(1.7);

    // With yield 1.7: output per cycle = 1*1.7 = 1.7
    // Time = 4/1 = 4s, output rate = 1.7/4 = 0.425/sec = 25.5/min
    // Target 17/min: machines = 17/25.5 = 0.667
    const result = calculateBom(state, {
      nodeId: product.id,
      slotId: slot.id,
      mode: 'continuous',
      targetQuantity: 17, // 17 items/min
      balancingStrategy: 'exact-decimal',
      byproductStrategy: 'ignore-annotate',
    });

    expect(result.tree.machineCount).toBeCloseTo(17 / 25.5, 3);
  });
});

// Scenario 10: Global effect tag matching
describe('Scenario 10: Global effect tag matching', () => {
  beforeEach(() => resetCounter());

  it('only matches effects whose target_tags intersect with slot+machine tags', () => {
    resetCounter();
    const machine = buildMachine({ id: 'default-machine', name: 'Furnace', base_speed: 1.0, tags: ['thermal'] });
    const raw = buildNode({ id: 'raw', name: 'Ore', is_raw_material: true });
    const slot = buildSlot({
      id: 's1', name: 'Smelting', time: 2, machine_id: machine.id,
      tags: ['smelting'], primary_output_quantity: 1,
    });
    const product = buildNode({
      id: 'prod', name: 'Ingot', is_raw_material: false,
      slots: [slot], active_slot_id: slot.id,
    });
    const edge = buildEdge({ id: 'e1', source: 'raw', target: 'prod', target_slot_id: slot.id, quantity: 1 });

    const matching = buildEffect({ id: 'eff1', name: 'Match', type: 'recipe_yield', target_tags: ['smelting'], multiplier: 2.0 });
    const nonMatching = buildEffect({ id: 'eff2', name: 'NoMatch', type: 'recipe_yield', target_tags: ['chemical'], multiplier: 3.0 });

    const state = buildState({
      machines: [machine], nodes: [raw, product], edges: [edge],
      global_effects: [matching, nonMatching],
    });

    const muls = computeMultipliers(state, slot);
    // Only matching applies: 1 + (2.0-1) = 2.0
    expect(muls.yieldMultiplier).toBeCloseTo(2.0);
  });

  it('machine_speed matches machine tags', () => {
    resetCounter();
    const machine = buildMachine({ id: 'default-machine', name: 'Furnace', base_speed: 1.0, tags: ['thermal'] });
    const slot = buildSlot({
      id: 's1', name: 'Craft', time: 2, machine_id: machine.id,
      tags: ['smelting'], primary_output_quantity: 1,
    });

    const speedEffect = buildEffect({ id: 'eff1', name: 'Speed Boost', type: 'machine_speed', target_tags: ['thermal'], multiplier: 1.5 });
    const noMatchEffect = buildEffect({ id: 'eff2', name: 'NoMatch', type: 'machine_speed', target_tags: ['chemical'], multiplier: 2.0 });

    const state = buildState({
      machines: [machine], nodes: [], edges: [],
      global_effects: [speedEffect, noMatchEffect],
    });

    const muls = computeMultipliers(state, slot);
    // speed = base_speed * (1 + (1.5-1)) = 1.0 * 1.5 = 1.5
    expect(muls.speedMultiplier).toBeCloseTo(1.5);
  });
});

describe('Phase 3.6: global effect enablement', () => {
  beforeEach(() => resetCounter());

  it('ignores disabled global effects when computing multipliers', () => {
    const machine = buildMachine({ id: 'default-machine', name: 'Furnace', base_speed: 1.0, tags: ['thermal'] });
    const slot = buildSlot({
      id: 's1', name: 'Smelting', time: 2, machine_id: machine.id,
      tags: ['smelting'], primary_output_quantity: 1,
    });

    const enabledEffect = buildEffect({
      id: 'eff-enabled',
      name: 'Enabled',
      type: 'recipe_yield',
      target_tags: ['smelting'],
      multiplier: 1.5,
      enabled: true,
    });
    const disabledEffect = buildEffect({
      id: 'eff-disabled',
      name: 'Disabled',
      type: 'recipe_yield',
      target_tags: ['smelting'],
      multiplier: 3.0,
      enabled: false,
    });

    const state = buildState({
      machines: [machine],
      nodes: [],
      edges: [],
      global_effects: [enabledEffect, disabledEffect],
    });

    const muls = computeMultipliers(state, slot);

    expect(muls.yieldMultiplier).toBeCloseTo(1.5);
  });
});

describe('Phase 3.7: global effects in one-time mode', () => {
  beforeEach(() => resetCounter());

  it('applies recipe_yield global effect when target_tags match product item tags', () => {
    // 产物节点标签属于物品标签池；该用例验证全局配方产量效果能通过物品标签命中当前产物。
    const machine = buildMachine({ id: 'default-machine', name: 'Assembler', base_speed: 1.0, tags: [] });
    const raw = buildNode({ id: 'raw', name: 'Ore', is_raw_material: true });
    const slot = buildSlot({
      id: 's1', name: 'Assembly', time: 4, machine_id: machine.id,
      tags: ['crafting'], primary_output_quantity: 1,
    });
    const product = buildNode({
      id: 'prod', name: 'Ingot', is_raw_material: false, tags: ['metal'],
      slots: [slot], active_slot_id: slot.id,
    });
    const edge = buildEdge({ id: 'e1', source: raw.id, target: product.id, target_slot_id: slot.id, quantity: 2 });

    const effect = buildEffect({
      id: 'eff-item-tag',
      name: 'Metal Yield',
      type: 'recipe_yield',
      target_tags: ['metal'],
      multiplier: 2.0,
    });

    const state = buildState({
      machines: [machine], nodes: [raw, product], edges: [edge],
      global_effects: [effect],
    });

    const result = calculateBom(state, {
      nodeId: product.id,
      slotId: slot.id,
      mode: 'one-time',
      targetQuantity: 10,
      balancingStrategy: 'integer-rounding',
      byproductStrategy: 'ignore-annotate',
    });

    // 物品标签命中后每次执行产出为 2，因此 10 个目标产物只需要 5 次执行。
    expect(result.tree.executionCount).toBe(5);
  });

  it('applies recipe_yield global effect to one-time BOM', () => {
    const machine = buildMachine({ id: 'default-machine', name: 'Furnace', base_speed: 1.0, tags: ['thermal'] });
    const raw = buildNode({ id: 'raw', name: 'Ore', is_raw_material: true });
    const slot = buildSlot({
      id: 's1', name: 'Smelting', time: 4, machine_id: machine.id,
      tags: ['smelting'], primary_output_quantity: 1,
    });
    const product = buildNode({
      id: 'prod', name: 'Ingot', is_raw_material: false,
      slots: [slot], active_slot_id: slot.id,
    });
    const edge = buildEdge({ id: 'e1', source: raw.id, target: product.id, target_slot_id: slot.id, quantity: 2 });

    const effect = buildEffect({
      id: 'eff1', name: 'Yield Boost',
      type: 'recipe_yield', target_tags: ['smelting'], multiplier: 2.0,
    });

    const state = buildState({
      machines: [machine], nodes: [raw, product], edges: [edge],
      global_effects: [effect],
    });

    const result = calculateBom(state, {
      nodeId: product.id,
      slotId: slot.id,
      mode: 'one-time',
      targetQuantity: 10,
      balancingStrategy: 'integer-rounding',
      byproductStrategy: 'ignore-annotate',
    });

    // yield multiplier = 2.0, output per execution = 1 * 2 = 2
    // ceil(10/2) = 5 executions
    expect(result.tree.executionCount).toBe(5);
    // input: 5 executions * 2 (edge qty) = 10
    expect(result.tree.inputs[0].quantity).toBe(10);
  });
});
