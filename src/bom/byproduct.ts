import type { State, RecipeSlot } from '../store';
import type { BomByproduct, ByproductStrategy, BomTreeNode } from './types';

export interface ByproductAccumulator {
  available: Map<string, number>;  // itemId -> total byproduct quantity available
  consumed: Map<string, number>;   // itemId -> total consumed by offset
}

export function createByproductAccumulator(): ByproductAccumulator {
  return {
    available: new Map(),
    consumed: new Map(),
  };
}

export function collectByproducts(
  state: State,
  slot: RecipeSlot,
  executionCount: number,
  strategy: ByproductStrategy,
  accumulator: ByproductAccumulator,
): BomByproduct[] {
  const byproducts: BomByproduct[] = [];

  for (const so of slot.secondary_outputs) {
    const node = state.nodes.find(n => n.id === so.item_id);
    const quantity = so.quantity * executionCount;

    const bp: BomByproduct = {
      itemId: so.item_id,
      itemName: node?.name || so.item_id,
      itemColor: node?.color || '#64748b',
      quantity,
    };

    if (strategy === 'offset') {
      accumulator.available.set(
        so.item_id,
        (accumulator.available.get(so.item_id) || 0) + quantity,
      );
    }

    byproducts.push(bp);
  }

  return byproducts;
}

export function applyOffsetStrategy(
  tree: BomTreeNode,
  accumulator: ByproductAccumulator,
): void {
  applyOffsetToNode(tree, accumulator);
}

function applyOffsetToNode(node: BomTreeNode, accumulator: ByproductAccumulator): void {
  for (const edge of node.inputs) {
    if (edge.child && !edge.child.isByproduct) {
      // Check if this input item has byproduct offset available
      const available = accumulator.available.get(edge.child.nodeId) || 0;
      const alreadyConsumed = accumulator.consumed.get(edge.child.nodeId) || 0;
      const remaining = available - alreadyConsumed;

      if (remaining > 0) {
        const offsetAmount = Math.min(remaining, edge.quantity);
        accumulator.consumed.set(
          edge.child.nodeId,
          alreadyConsumed + offsetAmount,
        );
        // Tag byproducts that were offset
        for (const bp of node.byproducts) {
          if (bp.itemId === edge.child.nodeId) {
            bp.offsetConsumed = (bp.offsetConsumed || 0) + offsetAmount;
          }
        }
        edge.quantity -= offsetAmount;
      }

      applyOffsetToNode(edge.child, accumulator);
    }
  }
}
