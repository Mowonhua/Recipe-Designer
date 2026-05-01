import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { calculateBom, BomCache } from '../bom';
import type { BomRequest, BomResult } from '../bom';
import { useStore } from './index';

export const useBomStore = defineStore('bom', () => {
  const store = useStore();

  const panelVisible = ref(false);
  const activeResult = ref<BomResult | null>(null);
  const pendingRequest = ref<BomRequest | null>(null);
  const isCalculating = ref(false);

  // Hover integration
  const highlightedNodeId = ref<string | null>(null);

  // Cache instance
  const cache = new BomCache();

  function calculateFromNode(nodeId: string, slotId: string | undefined) {
    const state = store.getState();
    panelVisible.value = true;

    if (!slotId) {
      const node = state.nodes.find(n => n.id === nodeId);
      activeResult.value = {
        request: {
          nodeId,
          slotId: '',
          mode: pendingRequest.value?.mode ?? 'one-time',
          targetQuantity: 0,
          balancingStrategy: 'integer-rounding',
          byproductStrategy: 'ignore-annotate',
        },
        tree: {
          nodeId,
          nodeName: node?.name || nodeId,
          nodeColor: node?.color || '#64748b',
          slotId: '',
          slotName: '(no recipe)',
          depth: 0,
          targetQuantity: 0,
          inputs: [],
          byproducts: [],
          isRawMaterial: true,
          isByproduct: false,
          isSurplus: false,
          isCatalystBlocked: false,
          isCycleDetected: false,
        },
        summary: [],
        warnings: [{ type: 'no_active_slot', nodeId, message: node?.is_raw_material === true ? `"${node.name}" is a raw material — no production recipe to calculate.` : `"${node?.name || nodeId}" has no active recipe slot.` }],
        computedAt: Date.now(),
      };
      return;
    }
    const request: BomRequest = {
      nodeId,
      slotId,
      mode: pendingRequest.value?.mode ?? 'one-time',
      targetQuantity: pendingRequest.value?.targetQuantity ?? 10,
      balancingStrategy: pendingRequest.value?.balancingStrategy ?? 'integer-rounding',
      byproductStrategy: pendingRequest.value?.byproductStrategy ?? 'ignore-annotate',
    };

    pendingRequest.value = request;

    const cached = cache.get(request, state);
    if (cached) {
      activeResult.value = cached;
      return;
    }

    isCalculating.value = true;
    try {
      const result = calculateBom(state, request);
      cache.set(request, result, state);
      activeResult.value = result;
    } finally {
      isCalculating.value = false;
    }
  }

  function recalculate() {
    if (!pendingRequest.value) return;
    const req = pendingRequest.value;
    calculateFromNode(req.nodeId, req.slotId);
  }

  function setHighlightedNodeId(id: string | null) {
    highlightedNodeId.value = id;
  }

  function clearHighlight() {
    highlightedNodeId.value = null;
  }

  // Invalidate cache on store changes
  watch(() => store.changeCounter, () => {
    cache.invalidate();
    if (pendingRequest.value) {
      recalculate();
    }
  });

  return {
    panelVisible,
    activeResult,
    pendingRequest,
    isCalculating,
    highlightedNodeId,
    cache,
    calculateFromNode,
    recalculate,
    setHighlightedNodeId,
    clearHighlight,
  };
});
