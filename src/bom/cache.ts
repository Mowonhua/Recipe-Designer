import type { State } from '../store';
import type { BomRequest, BomResult } from './types';

const MAX_CACHE_SIZE = 500;

export class BomCache {
  private entries = new Map<string, CacheEntry>();

  get(request: BomRequest, state: State): BomResult | null {
    const key = this.makeKey(request);
    const entry = this.entries.get(key);
    if (!entry) return null;

    const currentFingerprint = this.computeFingerprint(request, state);
    if (currentFingerprint !== entry.fingerprint) {
      this.entries.delete(key);
      return null;
    }

    // LRU: move to end (most recently used)
    this.entries.delete(key);
    this.entries.set(key, entry);

    return entry.result;
  }

  set(request: BomRequest, result: BomResult, state: State): void {
    const key = this.makeKey(request);

    // LRU eviction
    if (this.entries.size >= MAX_CACHE_SIZE) {
      const firstKey = this.entries.keys().next().value;
      if (firstKey !== undefined) this.entries.delete(firstKey);
    }

    this.entries.set(key, {
      result,
      fingerprint: this.computeFingerprint(request, state),
    });
  }

  invalidate(nodeId?: string): void {
    if (!nodeId) {
      this.entries.clear();
      return;
    }
    // Remove entries related to this node
    for (const [key] of this.entries) {
      if (key.startsWith(`${nodeId}:`)) {
        this.entries.delete(key);
      }
    }
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }

  private makeKey(req: BomRequest): string {
    return `${req.nodeId}:${req.slotId}:${req.mode}:${req.targetQuantity}`;
  }

  private computeFingerprint(request: BomRequest, state: State): string {
    const node = state.nodes.find(n => n.id === request.nodeId);
    const slot = node?.slots.find(s => s.id === request.slotId);

    const parts: unknown[] = [
      request.nodeId,
      request.slotId,
      request.mode,
      request.targetQuantity,
      request.balancingStrategy,
      request.byproductStrategy,
    ];

    if (slot) {
      parts.push({
        time: slot.time,
        primary_output_quantity: slot.primary_output_quantity,
        tags: slot.tags,
        catalyst_mode: slot.catalyst_mode,
        catalyst: slot.catalyst,
        secondary_outputs: slot.secondary_outputs,
        machine_id: slot.machine_id,
      });
    }

    if (node) {
      parts.push({ active_slot_id: node.active_slot_id });
    }

    // Include edges targeting this node/slot
    const relevantEdges = state.edges
      .filter(e => e.target === request.nodeId && e.target_slot_id === request.slotId)
      .map(e => ({ source: e.source, quantity: e.quantity, edge_type: e.edge_type }))
      .sort((a, b) => a.source.localeCompare(b.source));
    parts.push(relevantEdges);

    // Include active machine
    if (slot) {
      const machine = state.machines.find(m => m.id === slot.machine_id);
      if (machine) {
        parts.push({ base_speed: machine.base_speed, tags: machine.tags });
      }
    }

    // Include relevant global effects
    if (slot) {
      const slotTagSet = new Set(slot.tags);
      const machine = state.machines.find(m => m.id === slot.machine_id);
      const allTags = new Set([...slot.tags, ...(machine?.tags || [])]);

      const relevantEffects = state.global_effects
        .filter(e => e.type === 'recipe_yield' && e.target_tags.some(t => allTags.has(t))
          || e.type === 'machine_speed' && e.target_tags.some(t => allTags.has(t)))
        .map(e => ({ id: e.id, multiplier: e.multiplier }));
      parts.push(relevantEffects);
    }

    return JSON.stringify(parts);
  }
}

interface CacheEntry {
  result: BomResult;
  fingerprint: string;
}
