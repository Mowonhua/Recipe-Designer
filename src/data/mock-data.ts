import { v4 as uuidv4 } from 'uuid';
import type { ItemNode, FlowEdge, Machine, RecipeSlot } from '../store';

// --- Machines ---
const furnace: Machine = {
  id: uuidv4(),
  name: 'Stone Furnace',
  base_speed: 1.0,
  tags: ['thermal', 'basic'],
  allowed_recipe_tags: ['smelting'],
};

const assembler: Machine = {
  id: uuidv4(),
  name: 'Assembler Mk1',
  base_speed: 1.0,
  tags: ['electric', 'basic'],
  allowed_recipe_tags: ['crafting', 'chemistry'],
};

export const mockMachines: Machine[] = [furnace, assembler];

// --- Helper to create a slot ---
function slot(partial: Partial<RecipeSlot> & { name: string; time: number }): RecipeSlot {
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

// --- Helper to create a raw material node ---
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

// --- Helper to create a product node ---
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

// --- Helper to create an edge ---
function edge(source: string, target: string, targetSlotId: string, quantity: number, edgeType: 'input' | 'byproduct' = 'input'): FlowEdge {
  return {
    id: uuidv4(),
    source,
    target,
    target_slot_id: targetSlotId,
    quantity,
    edge_type: edgeType,
  };
}

// ============================================================
// Demo Production Line: Basic Circuit Factory
// ============================================================

// -- Bottom layer: Raw materials (y: 400-450) --
const ironOre = rawMaterial('Iron Ore', 100, 450, '#d4855e', ['ore', 'metal']);
const copperOre = rawMaterial('Copper Ore', 320, 450, '#e8944a', ['ore', 'metal']);
const coal = rawMaterial('Coal', 540, 450, '#3d3d3d', ['fuel']);
const water = rawMaterial('Water', 700, 350, '#4a90d9', ['fluid']);
const stone = rawMaterial('Stone', 700, 480, '#9e9e9e', ['mineral']);

// -- Middle layer 1: Smelting (y: 280-300) --
const ironIngotSlot = slot({ name: 'Iron Smelting', time: 3.2, tags: ['smelting'] });
const ironIngot = product('Iron Ingot', 200, 300, '#6b9ec4', [ironIngotSlot], ['ingot', 'metal']);

const copperIngotSlot = slot({ name: 'Copper Smelting', time: 3.2, tags: ['smelting'] });
const copperIngot = product('Copper Ingot', 420, 300, '#c4865a', [copperIngotSlot], ['ingot', 'metal']);

// -- Middle layer 2: Basic manufacturing (y: 150-180) --
const ironPlateSlot = slot({ name: 'Plate Rolling', time: 2.0, tags: ['crafting'], machine_id: assembler.id });
const ironPlate = product('Iron Plate', 150, 160, '#7bafcc', [ironPlateSlot], ['plate', 'metal']);

const copperWireSlot = slot({ name: 'Wire Drawing', time: 1.5, tags: ['crafting'], machine_id: assembler.id });
const copperWire = product('Copper Wire', 350, 160, '#d4956b', [copperWireSlot], ['wire', 'metal']);

const stoneBrickSlot = slot({ name: 'Stone Kiln', time: 2.5, tags: ['smelting'] });
const stoneBrick = product('Stone Brick', 600, 280, '#b0b0b0', [stoneBrickSlot], ['brick', 'mineral']);

// -- Top layer: Advanced products (y: 30-60) --
const circuitSlot = slot({
  name: 'Circuit Assembly',
  time: 5.0,
  tags: ['crafting'],
  machine_id: assembler.id,
  primary_output_quantity: 1,
});
const basicCircuit = product('Basic Circuit', 250, 50, '#5dbe7e', [circuitSlot], ['circuit', 'electronic']);

const concreteSlot = slot({
  name: 'Concrete Mixing',
  time: 4.0,
  tags: ['chemistry'],
  machine_id: assembler.id,
  primary_output_quantity: 2,
});
const concrete = product('Concrete', 650, 140, '#c9c9c9', [concreteSlot], ['building', 'mineral']);

// ============================================================
// Edges (bottom-up connections)
// ============================================================

const mockEdges: FlowEdge[] = [
  // Iron Ore → Iron Ingot
  edge(ironOre.id, ironIngot.id, ironIngotSlot.id, 1, 'input'),
  // Coal → Iron Ingot
  edge(coal.id, ironIngot.id, ironIngotSlot.id, 1, 'input'),

  // Copper Ore → Copper Ingot
  edge(copperOre.id, copperIngot.id, copperIngotSlot.id, 1, 'input'),
  // Coal → Copper Ingot
  edge(coal.id, copperIngot.id, copperIngotSlot.id, 1, 'input'),

  // Iron Ingot → Iron Plate
  edge(ironIngot.id, ironPlate.id, ironPlateSlot.id, 2, 'input'),

  // Copper Ingot → Copper Wire
  edge(copperIngot.id, copperWire.id, copperWireSlot.id, 1, 'input'),

  // Iron Plate → Basic Circuit
  edge(ironPlate.id, basicCircuit.id, circuitSlot.id, 2, 'input'),
  // Copper Wire → Basic Circuit
  edge(copperWire.id, basicCircuit.id, circuitSlot.id, 3, 'input'),

  // Stone → Stone Brick
  edge(stone.id, stoneBrick.id, stoneBrickSlot.id, 2, 'input'),

  // Stone Brick → Concrete
  edge(stoneBrick.id, concrete.id, concreteSlot.id, 3, 'input'),
  // Water → Concrete
  edge(water.id, concrete.id, concreteSlot.id, 1, 'input'),
];

// --- Add a byproduct: Iron Smelting produces Slag ---
const slag: ItemNode = {
  id: uuidv4(),
  name: 'Slag',
  color: '#8b7d6b',
  tags: ['byproduct', 'mineral'],
  is_raw_material: false,
  slots: [],
  position: { x: 100, y: 200 },
};
// Register slag as a byproduct of iron smelting
ironIngotSlot.secondary_outputs.push({ item_id: slag.id, quantity: 1 });

const mockNodes: ItemNode[] = [
  // Bottom: raw materials
  ironOre, copperOre, coal, water, stone,
  // Middle: ingots & bricks
  ironIngot, copperIngot, stoneBrick,
  // Middle-upper: plates & wires
  ironPlate, copperWire,
  // Top: final products
  basicCircuit, concrete,
  // Byproduct
  slag,
];

// Add byproduct edge (slag is produced BY iron ingot, no arrow, blue dashed)
mockEdges.push({
  id: uuidv4(),
  source: ironIngot.id,
  target: slag.id,
  target_slot_id: '',
  quantity: 1,
  edge_type: 'byproduct',
});

export { mockNodes, mockEdges };
