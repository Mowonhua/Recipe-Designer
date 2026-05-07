import { v4 as uuidv4 } from 'uuid';
import type { ItemNode, FlowEdge, Machine, RecipeSlot, GlobalEffect, Proliferator } from '../store';

// ============================================================
// Machines (4 — covering all slot type combos)
// ============================================================

const furnace: Machine = {
  id: uuidv4(),
  name: 'Stone Furnace',
  base_speed: 1.0,
  tags: ['thermal', 'basic'],
  allowed_recipe_tags: ['smelting'],
  slots: [
    { id: uuidv4(), type: 'input',  index: 0, capacity: 100 },
    { id: uuidv4(), type: 'input',  index: 1, capacity: 100 },
    { id: uuidv4(), type: 'output', index: 0, capacity: 200, is_main_output: true },
  ],
};

const assembler: Machine = {
  id: uuidv4(),
  name: 'Assembler Mk1',
  base_speed: 1.0,
  tags: ['electric', 'basic'],
  allowed_recipe_tags: ['crafting', 'chemistry'],
  slots: [
    { id: uuidv4(), type: 'input',       index: 0, capacity: 100 },
    { id: uuidv4(), type: 'input',       index: 1, capacity: 100 },
    { id: uuidv4(), type: 'input',       index: 2, capacity: 100 },
    { id: uuidv4(), type: 'output',      index: 0, capacity: 200, is_main_output: true },
    { id: uuidv4(), type: 'output',      index: 1, capacity: 200 },
    { id: uuidv4(), type: 'proliferator', index: 0, capacity: 100 },
  ],
};

const chemPlant: Machine = {
  id: uuidv4(),
  name: 'Chemical Plant',
  base_speed: 1.5,
  tags: ['electric', 'advanced'],
  allowed_recipe_tags: ['chemistry', 'refining'],
  slots: [
    { id: uuidv4(), type: 'input',       index: 0, capacity: 100, locked_item_tag: 'fluid' },
    { id: uuidv4(), type: 'input',       index: 1, capacity: 200 },
    { id: uuidv4(), type: 'output',      index: 0, capacity: 200, is_main_output: true },
    { id: uuidv4(), type: 'catalyst',    index: 0, capacity: 50 },
    { id: uuidv4(), type: 'proliferator', index: 0, capacity: 100 },
  ],
};

const advAssembler: Machine = {
  id: uuidv4(),
  name: 'Advanced Assembler',
  base_speed: 2.0,
  tags: ['electric', 'advanced', 'precision'],
  allowed_recipe_tags: ['crafting', 'chemistry', 'precision'],
  slots: [
    { id: uuidv4(), type: 'input',       index: 0, capacity: 200 },
    { id: uuidv4(), type: 'input',       index: 1, capacity: 200 },
    { id: uuidv4(), type: 'input',       index: 2, capacity: 200 },
    { id: uuidv4(), type: 'input',       index: 3, capacity: 200 },
    { id: uuidv4(), type: 'output',      index: 0, capacity: 500, is_main_output: true },
    { id: uuidv4(), type: 'output',      index: 1, capacity: 500 },
    { id: uuidv4(), type: 'catalyst',    index: 0, capacity: 50 },
    { id: uuidv4(), type: 'proliferator', index: 0, capacity: 100 },
  ],
};

export const mockMachines: Machine[] = [furnace, assembler, chemPlant, advAssembler];

// ============================================================
// Global Effects (2 — one yield, one speed)
// ============================================================

export const mockGlobalEffects: GlobalEffect[] = [
  {
    id: uuidv4(),
    name: 'Mining Efficiency',
    enabled: true,
    source: 'research',
    type: 'recipe_yield',
    target_tags: ['ore'],
    multiplier: 1.15,
  },
  {
    id: uuidv4(),
    name: 'Engineering Overclock',
    enabled: true,
    source: 'skill',
    type: 'machine_speed',
    target_tags: ['electric'],
    multiplier: 1.25,
  },
];

// ============================================================
// Proliferators (2)
// ============================================================

// We'll reference item IDs after nodes are created, so declare them upfront.
// Use placeholder strings that we replace after node creation.
// Actually, just reference the raw material names — they'll exist by seed time.

export function createMockProliferators(coalId: string, ironOreId: string): Proliferator[] {
  return [
    {
      id: uuidv4(),
      item_id: coalId,
      multiplier: 1.25,
      consumption_per_cycle: 1,
    },
    {
      id: uuidv4(),
      item_id: ironOreId,
      multiplier: 1.5,
      consumption_per_cycle: 2,
    },
  ];
}

// ============================================================
// Helpers
// ============================================================

function mkslot(partial: Partial<RecipeSlot> & { name: string; time: number }): RecipeSlot {
  return {
    id: uuidv4(),
    primary_output_quantity: 1,
    tags: [],
    secondary_outputs: [],
    catalyst_mode: 'none' as const,
    machine_id: furnace.id,
    ...partial,
  };
}

function rawMaterial(name: string, x: number, y: number, color: string, tags: string[] = []): ItemNode {
  return {
    id: uuidv4(),
    name,
    color,
    tags,
    is_raw_material: true,
    slots: [],
    position: { x, y },
  };
}

function product(name: string, x: number, y: number, color: string, slots: RecipeSlot[], tags: string[] = []): ItemNode {
  return {
    id: uuidv4(),
    name,
    color,
    tags,
    is_raw_material: false,
    slots,
    active_slot_id: slots[0]?.id,
    position: { x, y },
  };
}

function edge(
  source: string,
  target: string,
  targetSlotId: string,
  quantity: number,
  edgeType: 'input' | 'byproduct' | 'catalyst' = 'input',
  slotIndex?: number,
): FlowEdge {
  return {
    id: uuidv4(),
    source,
    target,
    target_slot_id: targetSlotId,
    quantity,
    edge_type: edgeType,
    slot_index: slotIndex,
  };
}

// ============================================================
// Nodes & Edges — Multi-stage Production Demo
// ============================================================

// ---------- Raw Materials (y: 460–520) ----------
const ironOre   = rawMaterial('Iron Ore',   60,  500, '#d4855e', ['ore', 'metal']);
const copperOre = rawMaterial('Copper Ore', 240, 500, '#e8944a', ['ore', 'metal']);
const coal      = rawMaterial('Coal',       420, 500, '#3d3d3d', ['fuel']);
const water     = rawMaterial('Water',      600, 460, '#4a90d9', ['fluid']);
const stone     = rawMaterial('Stone',      600, 540, '#9e9e9e', ['mineral']);
const crudeOil  = rawMaterial('Crude Oil',  780, 500, '#2d2d2d', ['fluid', 'fuel']);

// ---------- Smelting (y: 340–380) ----------

// Iron Ingot — TWO recipe slots (multi-slot demo)
const ironSmeltSlot = mkslot({
  name: 'Stone Furnace Smelting',
  time: 3.2,
  tags: ['smelting'],
  machine_id: furnace.id,
});
const ironArcSlot = mkslot({
  name: 'Electric Arc Smelting',
  time: 2.0,
  tags: ['smelting', 'electric'],
  machine_id: assembler.id,
  primary_output_quantity: 2,
});
const ironIngot = product('Iron Ingot', 140, 360, '#6b9ec4', [ironSmeltSlot, ironArcSlot], ['ingot', 'metal']);

const copperIngotSlot = mkslot({ name: 'Copper Smelting', time: 3.2, tags: ['smelting'] });
const copperIngot = product('Copper Ingot', 360, 360, '#c4865a', [copperIngotSlot], ['ingot', 'metal']);

const stoneBrickSlot = mkslot({ name: 'Stone Kiln', time: 2.5, tags: ['smelting'] });
const stoneBrick = product('Stone Brick', 640, 360, '#b0b0b0', [stoneBrickSlot], ['brick', 'mineral']);

// ---------- Steel Ingot (ordered recipe demo, y: 260) ----------
const steelSlot = mkslot({
  name: 'Steel Smelting',
  time: 6.0,
  tags: ['smelting'],
  machine_id: furnace.id,
  primary_output_quantity: 1,
});
const steelIngot = product('Steel Ingot', 60, 260, '#8fa9b8', [steelSlot], ['ingot', 'metal', 'alloy']);

// ---------- Manufacturing (y: 240–280) ----------
const ironPlateSlot = mkslot({
  name: 'Plate Rolling',
  time: 2.0,
  tags: ['crafting'],
  machine_id: assembler.id,
});
const ironPlate = product('Iron Plate', 140, 220, '#7bafcc', [ironPlateSlot], ['plate', 'metal']);

const copperWireSlot = mkslot({
  name: 'Wire Drawing',
  time: 1.5,
  tags: ['crafting'],
  machine_id: assembler.id,
});
const copperWire = product('Copper Wire', 340, 220, '#d4956b', [copperWireSlot], ['wire', 'metal']);

// ---------- Plastic (catalyst recipe, y: 240) ----------
const plasticSlot = mkslot({
  name: 'Plastic Refining',
  time: 4.0,
  tags: ['chemistry'],
  machine_id: chemPlant.id,
  catalyst_mode: 'required',
  catalyst: { item_id: coal.id, quantity: 1, speed_multiplier: 1.5 },
});
const plastic = product('Plastic', 560, 220, '#e0c080', [plasticSlot], ['polymer', 'chemistry']);

// ---------- Final Products (y: 60–120) ----------
const circuitSlot = mkslot({
  name: 'Circuit Assembly',
  time: 5.0,
  tags: ['crafting'],
  machine_id: assembler.id,
  primary_output_quantity: 1,
});
const basicCircuit = product('Basic Circuit', 240, 80, '#5dbe7e', [circuitSlot], ['circuit', 'electronic']);

const concreteSlot = mkslot({
  name: 'Concrete Mixing',
  time: 4.0,
  tags: ['chemistry'],
  machine_id: assembler.id,
  primary_output_quantity: 2,
});
const concrete = product('Concrete', 680, 120, '#c9c9c9', [concreteSlot], ['building', 'mineral']);

// Advanced Circuit — uses proliferator + catalyst (optional)
const advCircuitSlot = mkslot({
  name: 'Advanced Circuit Assembly',
  time: 8.0,
  tags: ['crafting', 'precision'],
  machine_id: advAssembler.id,
  primary_output_quantity: 1,
  catalyst_mode: 'optional',
});
const advancedCircuit = product('Advanced Circuit', 420, 60, '#4ae08a', [advCircuitSlot], ['circuit', 'electronic', 'advanced']);

// ---------- Byproducts (y: 300) ----------
const slag: ItemNode = {
  id: uuidv4(),
  name: 'Slag',
  color: '#8b7d6b',
  tags: ['byproduct', 'mineral'],
  is_raw_material: false,
  slots: [],
  position: { x: 0, y: 300 },
};
ironSmeltSlot.secondary_outputs.push({ item_id: slag.id, quantity: 1 });

const heavyOil: ItemNode = {
  id: uuidv4(),
  name: 'Heavy Oil Residue',
  color: '#5c3d2e',
  tags: ['byproduct', 'fluid', 'fuel'],
  is_raw_material: false,
  slots: [],
  position: { x: 740, y: 300 },
};
// Assign byproduct to specific output slot index
plasticSlot.secondary_outputs.push({ item_id: heavyOil.id, quantity: 1, slot_index: 1 });

// ============================================================
// Edges
// ============================================================

const mockEdges: FlowEdge[] = [
  // --- Smelting inputs ---
  // Iron Ore → Iron Ingot (slot #0), Coal → Iron Ingot (slot #1) — ordered recipe
  edge(ironOre.id,  ironIngot.id, ironSmeltSlot.id, 1, 'input', 0),
  edge(coal.id,     ironIngot.id, ironSmeltSlot.id, 1, 'input', 1),

  // Copper Ore → Copper Ingot
  edge(copperOre.id, copperIngot.id, copperIngotSlot.id, 1, 'input'),
  edge(coal.id,      copperIngot.id, copperIngotSlot.id, 1, 'input'),

  // Stone → Stone Brick
  edge(stone.id, stoneBrick.id, stoneBrickSlot.id, 2, 'input'),

  // --- Steel (ordered, explicit slot_index) ---
  edge(ironOre.id, steelIngot.id, steelSlot.id, 2, 'input', 0),
  edge(coal.id,    steelIngot.id, steelSlot.id, 3, 'input', 1),

  // --- Manufacturing ---
  // Iron Ingot → Iron Plate
  edge(ironIngot.id, ironPlate.id, ironPlateSlot.id, 2, 'input'),
  // Copper Ingot → Copper Wire
  edge(copperIngot.id, copperWire.id, copperWireSlot.id, 1, 'input'),

  // --- Plastic (catalyst) ---
  edge(crudeOil.id, plastic.id, plasticSlot.id, 3, 'input'),
  edge(water.id,    plastic.id, plasticSlot.id, 2, 'input'),
  // Catalyst edge: Coal → Plastic (catalyst)
  edge(coal.id, plastic.id, plasticSlot.id, 1, 'catalyst'),

  // --- Final products ---
  // Iron Plate → Basic Circuit
  edge(ironPlate.id,  basicCircuit.id, circuitSlot.id, 2, 'input'),
  // Copper Wire → Basic Circuit
  edge(copperWire.id, basicCircuit.id, circuitSlot.id, 3, 'input'),

  // Stone Brick → Concrete
  edge(stoneBrick.id, concrete.id, concreteSlot.id, 3, 'input'),
  // Water → Concrete
  edge(water.id, concrete.id, concreteSlot.id, 1, 'input'),

  // Advanced Circuit
  edge(plastic.id,    advancedCircuit.id, advCircuitSlot.id, 1, 'input', 0),
  edge(ironPlate.id,  advancedCircuit.id, advCircuitSlot.id, 3, 'input', 1),
  edge(copperWire.id, advancedCircuit.id, advCircuitSlot.id, 2, 'input', 2),
];

// --- Byproduct edges ---
mockEdges.push(
  edge(ironIngot.id, slag.id,    '', 1, 'byproduct'),
  edge(plastic.id,   heavyOil.id, '', 1, 'byproduct'),
);

// --- Iron Ingot second slot edges (Electric Arc) ---
mockEdges.push(
  edge(ironOre.id, ironIngot.id, ironArcSlot.id, 2, 'input'),
  edge(coal.id,    ironIngot.id, ironArcSlot.id, 2, 'input'),
);

// ============================================================
// Assemble
// ============================================================

const mockNodes: ItemNode[] = [
  // Raw materials
  ironOre, copperOre, coal, water, stone, crudeOil,
  // Smelting
  ironIngot, copperIngot, steelIngot, stoneBrick,
  // Manufacturing
  ironPlate, copperWire, plastic,
  // Final products
  basicCircuit, concrete, advancedCircuit,
  // Byproducts
  slag, heavyOil,
];

// Build proliferators referencing raw material IDs
const mockProliferators = createMockProliferators(coal.id, ironOre.id);

export { mockNodes, mockEdges, mockProliferators };
