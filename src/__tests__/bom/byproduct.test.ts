import { describe, it, expect, beforeEach } from 'vitest';
import { calculateBom } from '../../bom';
import { buildState, buildNode, buildSlot, buildEdge, buildMachine, resetCounter } from './fixtures';

// Scenario 4: Byproduct three strategies
describe('Scenario 4: Byproduct strategies', () => {
  beforeEach(() => resetCounter());

  function buildByproductState() {
    resetCounter();
    const machine = buildMachine({ id: 'default-machine', name: 'Default' });
    const raw = buildNode({ id: 'raw', name: 'Iron Ore', is_raw_material: true });
    // Slag has no slots — it's a pure byproduct item, so auto-detected as raw (no incoming input edges)
    const slag = buildNode({ id: 'slag', name: 'Slag', is_raw_material: false, color: '#8b7d6b' });
    const slot = buildSlot({
      id: 's1', name: 'Smelting', time: 3, machine_id: machine.id,
      secondary_outputs: [{ item_id: 'slag', quantity: 1 }],
    });
    const product = buildNode({
      id: 'prod', name: 'Iron Ingot', is_raw_material: false,
      slots: [slot], active_slot_id: slot.id, color: '#6b9ec4',
    });
    const edge = buildEdge({ id: 'e1', source: 'raw', target: 'prod', target_slot_id: slot.id, quantity: 1 });

    return buildState({ machines: [machine], nodes: [raw, slag, product], edges: [edge] });
  }

  it('ignore-annotate: records byproduct but does not trace upstream', () => {
    const state = buildByproductState();

    const result = calculateBom(state, {
      nodeId: 'prod',
      slotId: 's1',
      mode: 'one-time',
      targetQuantity: 10,
      balancingStrategy: 'integer-rounding',
      byproductStrategy: 'ignore-annotate',
    });

    expect(result.tree.byproducts).toHaveLength(1);
    expect(result.tree.byproducts[0].itemId).toBe('slag');
    expect(result.tree.byproducts[0].quantity).toBe(10);
    // Slag should not appear as a child branch
    const allInputIds = result.tree.inputs.map(i => i.sourceNodeId);
    expect(allInputIds).not.toContain('slag');
  });

  it('offset: accumulates byproduct availability', () => {
    const state = buildByproductState();

    const result = calculateBom(state, {
      nodeId: 'prod',
      slotId: 's1',
      mode: 'one-time',
      targetQuantity: 10,
      balancingStrategy: 'integer-rounding',
      byproductStrategy: 'offset',
    });

    // Offset strategy collects byproduct amounts
    expect(result.tree.byproducts).toHaveLength(1);
    expect(result.tree.byproducts[0].quantity).toBe(10);
    expect(result).toBeTruthy();
  });

  it('independent-output: byproduct creates a separate branch (as raw since slag has no slots)', () => {
    const state = buildByproductState();

    const result = calculateBom(state, {
      nodeId: 'prod',
      slotId: 's1',
      mode: 'one-time',
      targetQuantity: 10,
      balancingStrategy: 'integer-rounding',
      byproductStrategy: 'independent-output',
    });

    // Slag has no active slot and is treated as raw (no incoming input edges)
    // So in independent-output mode, it appears as a leaf edge
    expect(result.tree.byproducts).toHaveLength(1);
    const hasSlagInput = result.tree.inputs.some(i => i.sourceNodeId === 'slag');
    expect(hasSlagInput).toBe(true);
  });
});
