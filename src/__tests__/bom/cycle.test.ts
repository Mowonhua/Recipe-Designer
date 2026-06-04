import { describe, it, expect, beforeEach } from 'vitest';
import { calculateBom } from '../../bom';
import { buildState, buildNode, buildSlot, buildEdge, buildMachine, resetCounter } from './fixtures';
import type { State, ItemNode, FlowEdge, Machine } from '../../store';

// Scenario 12: Cycle exception detection
describe('Scenario 12: Cycle detection', () => {
  beforeEach(() => resetCounter());

  it('detects cycle and emits warning, skips the branch', () => {
    resetCounter();
    const machine = buildMachine({ id: 'default-machine', name: 'Default' });
    const raw = buildNode({ id: 'raw', name: 'Water', is_raw_material: true });

    const slotA = buildSlot({ id: 'sA', name: 'Make A', time: 2, machine_id: machine.id });
    const nodeA = buildNode({ id: 'A', name: 'A', is_raw_material: false, slots: [slotA], active_slot_id: slotA.id });

    const slotB = buildSlot({ id: 'sB', name: 'Make B', time: 2, machine_id: machine.id });
    const nodeB = buildNode({ id: 'B', name: 'B', is_raw_material: false, slots: [slotB], active_slot_id: slotB.id });

    const edges = [
      buildEdge({ id: 'e1', source: 'raw', target: 'A', target_slot_id: slotA.id, quantity: 1 }),
      buildEdge({ id: 'e2', source: 'A', target: 'B', target_slot_id: slotB.id, quantity: 1 }),
      buildEdge({ id: 'e3', source: 'B', target: 'A', target_slot_id: slotA.id, quantity: 1 }), // cycle!
    ];

    const state = buildState({ machines: [machine], nodes: [raw, nodeA, nodeB], edges });

    const result = calculateBom(state, {
      nodeId: 'B',
      slotId: slotB.id,
      mode: 'one-time',
      targetQuantity: 5,
      balancingStrategy: 'integer-rounding',
      byproductStrategy: 'ignore-annotate',
    });

    expect(result.warnings.some(w => w.type === 'cycle')).toBe(true);
  });

  it('max depth exits gracefully', () => {
    resetCounter();
    const machine: Machine = { id: 'm', name: 'M', base_speed: 1.0, tags: [], allowed_recipe_tags: [] };
    const nodes: ItemNode[] = [];
    const edges: FlowEdge[] = [];

    // Build a deep chain: n55 (raw) -> n54 -> ... -> n1 -> n0 (target)
    // Edge direction: source supplies target, so edges go n(i+1) -> n(i)
    for (let i = 0; i <= 55; i++) {
      const slotId = `s${i}`;
      const nodeId = `n${i}`;
      nodes.push({
        id: nodeId,
        name: `Node${i}`,
        tags: [],
        is_raw_material: i === 55,
        slots: [{
          id: slotId,
          name: `Step${i}`,
          time: 1,
          machine_id: machine.id,
          tags: [],
          primary_output_quantity: 1,
          secondary_outputs: [],
          catalyst_mode: 'none',
        }],
        active_slot_id: slotId,
        position: { x: 0, y: 0 },
      });

      // Edge: n(i+1) → n(i) meaning n(i) consumes n(i+1)
      if (i > 0) {
        edges.push({
          id: `e${i}`,
          source: `n${i}`,
          target: `n${i-1}`,
          target_slot_id: `s${i-1}`,
          quantity: 1,
          edge_type: 'input',
        });
      }
    }

    const state: State = {
      version: 1,
      meta: { created: '', updated: '', game: 'test', viewport: { zoom: 1, center: { x: 0, y: 0 } } },
      global_effects: [],
      proliferators: [],
      tag_pool: { recipe_tags: [], machine_tags: [] },
      machines: [machine],
      nodes,
      edges,
      groups: [],
      templates: [],
    };

    // Start from n0, which consumes n1, which consumes n2, ... up to n55 (raw)
    const result = calculateBom(state, {
      nodeId: 'n0',
      slotId: 's0',
      mode: 'one-time',
      targetQuantity: 1,
      balancingStrategy: 'integer-rounding',
      byproductStrategy: 'ignore-annotate',
    });

    // n55 is is_raw_material=true so recursion stops there.
    // Depth from n0 to n55 is 55. MAX_DEPTH is 50. So we should hit max depth.
    // But wait, n55 stops early since it's raw. The path n0->n1->...->n54 has depth 54.
    // n54 consumes n55 but n55 is raw, so n55 is just a leaf edge.
    // The actual recursion goes n0(depth0)->n1(depth1)->...->n50(depth 50) should trigger MAX_DEPTH.
    expect(result.warnings.some(w => w.type === 'cycle')).toBe(true);
  });
});
