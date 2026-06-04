import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useBomStore } from '../../store/bom-store';
import { useStore } from '../../store';
import { buildEdge, buildMachine, buildNode, buildSlot, resetCounter } from './fixtures';

describe('BOM store proliferator assignments', () => {
  beforeEach(() => {
    resetCounter();
    setActivePinia(createPinia());
  });

  it('preserves proliferator assignments when recalculating from the pending request', () => {
    const store = useStore();
    const bomStore = useBomStore();
    const machine = buildMachine({ id: 'assembler', name: 'Assembler', base_speed: 1 });
    const raw = buildNode({ id: 'raw', name: 'Raw', is_raw_material: true });
    const spray = buildNode({ id: 'spray', name: 'Spray', is_raw_material: true });
    const slot = buildSlot({
      id: 'slot',
      name: 'Craft',
      time: 2,
      machine_id: machine.id,
      primary_output_quantity: 1,
    });
    const product = buildNode({
      id: 'product',
      name: 'Product',
      is_raw_material: false,
      slots: [slot],
      active_slot_id: slot.id,
    });
    const edge = buildEdge({
      id: 'edge',
      source: raw.id,
      target: product.id,
      target_slot_id: slot.id,
      quantity: 1,
    });

    store.seedData({
      machines: [machine],
      nodes: [raw, spray, product],
      edges: [edge],
      proliferators: [
        { id: 'proliferator', item_id: spray.id, multiplier: 2, consumption_per_cycle: 1 },
      ],
    });

    bomStore.pendingRequest = {
      nodeId: product.id,
      slotId: slot.id,
      mode: 'continuous',
      targetQuantity: 60,
      balancingStrategy: 'exact-decimal',
      byproductStrategy: 'ignore-annotate',
      proliferatorAssignments: { [machine.id]: 'proliferator' },
    };

    bomStore.calculateFromNode(product.id, slot.id);

    expect(bomStore.pendingRequest?.proliferatorAssignments).toEqual({ [machine.id]: 'proliferator' });
    expect(bomStore.activeResult?.request.proliferatorAssignments).toEqual({ [machine.id]: 'proliferator' });
    expect(bomStore.activeResult?.tree.machineCount).toBeCloseTo(1);
  });
});
