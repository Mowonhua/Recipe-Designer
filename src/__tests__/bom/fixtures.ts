import type { State, ItemNode, Machine, RecipeSlot, FlowEdge, GlobalEffect, Group } from '../../store';

let counter = 0;
function id(prefix: string): string { return `${prefix}-${++counter}`; }

export function resetCounter(): void { counter = 0; }

export function buildMachine(overrides?: Partial<Machine>): Machine {
  return {
    id: id('machine'),
    name: 'Standard Machine',
    base_speed: 1.0,
    tags: [],
    allowed_recipe_tags: [],
    ...overrides,
  };
}

export function buildSlot(overrides?: Partial<RecipeSlot> & { name?: string }): RecipeSlot {
  return {
    id: id('slot'),
    name: overrides?.name || 'Default Slot',
    time: 1,
    machine_id: overrides?.machine_id || 'default-machine',
    tags: [],
    primary_output_quantity: 1,
    secondary_outputs: [],
    catalyst_mode: 'none',
    ...overrides,
  };
}

export function buildNode(overrides?: Partial<ItemNode>): ItemNode {
  return {
    id: id('node'),
    name: 'Item',
    tags: [],
    is_raw_material: null,
    slots: [],
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

export function buildEdge(overrides?: Partial<FlowEdge>): FlowEdge {
  return {
    id: id('edge'),
    source: '',
    target: '',
    target_slot_id: '',
    quantity: 1,
    edge_type: 'input',
    ...overrides,
  };
}

export function buildEffect(overrides?: Partial<GlobalEffect>): GlobalEffect {
  return {
    id: id('effect'),
    name: 'Effect',
    enabled: true,
    source: 'other',
    type: 'recipe_yield',
    target_tags: [],
    multiplier: 1.0,
    ...overrides,
  };
}

export function buildGroup(overrides?: Partial<Group>): Group {
  return {
    id: id('group'),
    name: 'Group',
    children: [],
    collapsed: true,
    ...overrides,
  };
}

export function buildState(overrides?: Partial<State>): State {
  return {
    version: 1,
    meta: { created: '', updated: '', game: 'test', viewport: { zoom: 1, center: { x: 0, y: 0 } } },
    global_effects: [],
    proliferators: [],
    tag_pool: { recipe_tags: [], machine_tags: [] },
    machines: [buildMachine({ id: 'default-machine', name: 'Default' })],
    nodes: [],
    edges: [],
    groups: [],
    templates: [],
    ...overrides,
  };
}

export function buildSimpleChain(): {
  state: State;
  rawId: string;
  midId: string;
  targetId: string;
  midSlotId: string;
  targetSlotId: string;
} {
  resetCounter();
  const machine = buildMachine({ id: 'default-machine', name: 'Default' });
  const raw = buildNode({ id: 'raw', name: 'Iron Ore', is_raw_material: true, color: '#aa8855' });
  const midSlot = buildSlot({ id: 'mid-slot', name: 'Smelting', time: 3, machine_id: machine.id, tags: ['smelting'] });
  const mid = buildNode({
    id: 'mid', name: 'Iron Ingot', is_raw_material: false,
    slots: [midSlot], active_slot_id: midSlot.id, color: '#6b9ec4',
  });
  const targetSlot = buildSlot({ id: 'target-slot', name: 'Crafting', time: 2, machine_id: machine.id, primary_output_quantity: 1 });
  const target = buildNode({
    id: 'target', name: 'Iron Plate', is_raw_material: false,
    slots: [targetSlot], active_slot_id: targetSlot.id, color: '#7bafcc',
  });

  const edges: FlowEdge[] = [
    buildEdge({ id: 'e1', source: raw.id, target: mid.id, target_slot_id: midSlot.id, quantity: 1 }),
    buildEdge({ id: 'e2', source: mid.id, target: target.id, target_slot_id: targetSlot.id, quantity: 2 }),
  ];

  return {
    state: buildState({ machines: [machine], nodes: [raw, mid, target], edges }),
    rawId: raw.id,
    midId: mid.id,
    targetId: target.id,
    midSlotId: midSlot.id,
    targetSlotId: targetSlot.id,
  };
}

export function buildDiamondGraph(): {
  state: State;
  rawAId: string;
  rawBId: string;
  targetId: string;
  targetSlotId: string;
} {
  resetCounter();
  const machine = buildMachine({ id: 'default-machine', name: 'Default' });
  const rawA = buildNode({ id: 'rawA', name: 'Copper Ore', is_raw_material: true, color: '#e8944a' });
  const rawB = buildNode({ id: 'rawB', name: 'Iron Ore', is_raw_material: true, color: '#aa8855' });
  const targetSlot = buildSlot({ id: 'target-slot', name: 'Assembly', time: 5, machine_id: machine.id, primary_output_quantity: 1 });
  const target = buildNode({
    id: 'target', name: 'Basic Circuit', is_raw_material: false,
    slots: [targetSlot], active_slot_id: targetSlot.id, color: '#5dbe7e',
  });

  const edges: FlowEdge[] = [
    buildEdge({ id: 'e1', source: rawA.id, target: target.id, target_slot_id: targetSlot.id, quantity: 3 }),
    buildEdge({ id: 'e2', source: rawB.id, target: target.id, target_slot_id: targetSlot.id, quantity: 2 }),
  ];

  return {
    state: buildState({ machines: [machine], nodes: [rawA, rawB, target], edges }),
    rawAId: rawA.id,
    rawBId: rawB.id,
    targetId: target.id,
    targetSlotId: targetSlot.id,
  };
}
