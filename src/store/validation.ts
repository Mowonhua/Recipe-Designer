// src/store/validation.ts — Pure topology validation functions
import type { State, ItemNode, Machine } from './index';

export interface ValidationError {
  type: 'reference' | 'tag_mismatch' | 'cycle' | 'orphan'; // 'orphan' reserved for future orphan validation reporting
  severity: 'error' | 'warning';
  nodeIds: string[];
  message: string;
}

export interface CycleResult {
  hasCycle: boolean;
  path: string[];  // node IDs forming the cycle, empty if no cycle
}

const MAX_DEPTH = 50;

// --- Helpers ---

function buildNodeMap(state: State): Map<string, ItemNode> {
  return new Map(state.nodes.map(n => [n.id, n]));
}

function buildMachineMap(state: State): Map<string, Machine> {
  return new Map(state.machines.map(m => [m.id, m]));
}

// --- 1. checkReferenceIntegrity ---

export function checkReferenceIntegrity(state: State): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeMap = buildNodeMap(state);
  const machineMap = buildMachineMap(state);

  for (const edge of state.edges) {
    const targetNode = nodeMap.get(edge.target);
    if (!targetNode) {
      errors.push({
        type: 'reference',
        severity: 'error',
        nodeIds: [edge.source, edge.target],
        message: `Edge "${edge.id}" targets node "${edge.target}" which does not exist.`,
      });
      continue;
    }
    // Byproduct edges don't require a target slot
    const slotExists = edge.edge_type === 'byproduct'
      ? true
      : targetNode.slots.some(s => s.id === edge.target_slot_id);
    if (!slotExists) {
      errors.push({
        type: 'reference',
        severity: 'error',
        nodeIds: [edge.target],
        message: `Edge "${edge.id}" references slot "${edge.target_slot_id}" on node "${edge.target}", but that slot does not exist.`,
      });
    }
  }

  for (const node of state.nodes) {
    for (const slot of node.slots) {
      // Check machine_id reference
      if (!machineMap.has(slot.machine_id)) {
        errors.push({
          type: 'reference',
          severity: 'error',
          nodeIds: [node.id],
          message: `Slot "${slot.name}" (${slot.id}) on node "${node.name}" references machine "${slot.machine_id}" which does not exist.`,
        });
      }

      // Check secondary_outputs item_id references
      for (const so of slot.secondary_outputs) {
        if (!nodeMap.has(so.item_id)) {
          errors.push({
            type: 'reference',
            severity: 'error',
            nodeIds: [node.id],
            message: `Slot "${slot.name}" (${slot.id}) on node "${node.name}" has secondary output referencing item "${so.item_id}" which does not exist.`,
          });
        }
      }

      // Check catalyst item_id reference
      if (slot.catalyst && !nodeMap.has(slot.catalyst.item_id)) {
        errors.push({
          type: 'reference',
          severity: 'error',
          nodeIds: [node.id],
          message: `Slot "${slot.name}" (${slot.id}) on node "${node.name}" has catalyst referencing item "${slot.catalyst.item_id}" which does not exist.`,
        });
      }
    }
  }

  return errors;
}

// --- 2. checkTagMatches ---

export function checkTagMatches(state: State): ValidationError[] {
  const warnings: ValidationError[] = [];
  const machineMap = buildMachineMap(state);

  for (const node of state.nodes) {
    for (const slot of node.slots) {
      // If slot has no tags, it is unrestricted — skip
      if (slot.tags.length === 0) continue;

      const machine = machineMap.get(slot.machine_id);
      if (!machine) continue; // reference error handles this elsewhere

      // Check intersection: slot.tags ∩ machine.allowed_recipe_tags ≠ ∅
      const machineTagSet = new Set(machine.allowed_recipe_tags);
      const hasOverlap = slot.tags.some(tag => machineTagSet.has(tag));

      if (!hasOverlap) {
        warnings.push({
          type: 'tag_mismatch',
          severity: 'warning',
          nodeIds: [node.id],
          message: `Slot "${slot.name}" on node "${node.name}" has tags [${slot.tags.join(', ')}] which do not match machine "${machine.name}" allowed tags [${machine.allowed_recipe_tags.join(', ')}].`,
        });
      }
    }
  }

  return warnings;
}

// --- 3. checkCycle ---

export function checkCycle(
  state: State,
  newEdge: { source: string; target: string }
): CycleResult {
  // Quick check: self-loop
  if (newEdge.source === newEdge.target) {
    return { hasCycle: true, path: [newEdge.source, newEdge.target] };
  }

  // BFS upstream from newEdge.source, following active-slot input edges.
  // Walk "up" the supply chain (toward raw materials) from the source, looking for
  // newEdge.target. If target is found, it is already a transitive supplier of
  // source (target → … → source exists), so adding source → target creates a cycle:
  // source → target → … → source.
  const visited = new Map<string, string>(); // supplierId -> consumerId (for path reconstruction)
  const queue: string[] = [newEdge.source];
  visited.set(newEdge.source, ''); // entry marker – root of BFS tree, no parent

  // Precompute incoming-edge adjacency map keyed by target node id
  const nodeMap = buildNodeMap(state);
  const incoming = new Map<string, typeof state.edges>();
  for (const e of state.edges) {
    if (e.edge_type !== 'input') continue;
    const targetNode = nodeMap.get(e.target);
    if (!targetNode || !targetNode.active_slot_id) continue;
    if (e.target_slot_id !== targetNode.active_slot_id) continue;
    const list = incoming.get(e.target) || [];
    list.push(e);
    incoming.set(e.target, list);
  }

  let depth = 0;
  while (queue.length > 0 && depth < MAX_DEPTH) {
    const levelSize = queue.length;
    for (let i = 0; i < levelSize; i++) {
      const currentId = queue.shift()!;

      // Find all input edges where this node is the target (i.e., its suppliers)
      const incomingEdges = incoming.get(currentId) || [];

      for (const edge of incomingEdges) {
        const supplierId = edge.source;

        // Found newEdge.target as a transitive supplier → cycle detected
        if (supplierId === newEdge.target) {
          // Reconstruct the existing path: target → currentId → … → source
          // Then form the cycle: source → target → currentId → … → source
          const cyclePath: string[] = [newEdge.source, newEdge.target];
          let cursor = currentId;
          while (true) {
            cyclePath.push(cursor);
            if (cursor === newEdge.source) break;
            const next = visited.get(cursor);
            if (!next || next === cursor) break;
            cursor = next;
          }
          return { hasCycle: true, path: cyclePath };
        }

        if (!visited.has(supplierId)) {
          visited.set(supplierId, currentId);
          queue.push(supplierId);
        }
      }
    }
    depth++;
  }

  return { hasCycle: false, path: [] };
}

// --- 4. findOrphans ---

export function findOrphans(state: State): ItemNode[] {
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  // Initialize degree maps for all nodes
  for (const node of state.nodes) {
    inDegree.set(node.id, 0);
    outDegree.set(node.id, 0);
  }

  // Count all edges (both input and byproduct) for degree computation
  for (const edge of state.edges) {
    outDegree.set(edge.source, (outDegree.get(edge.source) ?? 0) + 1);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  // A node is orphan if in_degree === 0 AND out_degree === 0
  return state.nodes.filter(node => {
    const inDeg = inDegree.get(node.id) ?? 0;
    const outDeg = outDegree.get(node.id) ?? 0;
    return inDeg === 0 && outDeg === 0;
  });
}

// --- 5. validateAll ---

export function validateAll(state: State): ValidationError[] {
  return [
    ...checkReferenceIntegrity(state),
    ...checkTagMatches(state),
  ];
}
