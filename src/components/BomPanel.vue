<template>
  <n-drawer
    :show="bomStore.panelVisible"
    :width="480"
    placement="right"
    @update:show="onUpdateShow"
  >
    <n-drawer-content :title="$t('bom.title')" closable>
      <!-- Configuration -->
      <div class="config-block">
        <div class="config-header">
          <span class="config-label">{{ $t('bom.targetNode') }}</span>
          <span class="config-value">{{ targetNodeName }}</span>
        </div>

        <div class="form-row">
          <div class="form-group flex-1">
            <label>{{ $t('bom.mode') }}</label>
            <n-select
              v-model:value="editMode"
              :options="modeOptions"
              size="small"
            />
          </div>
          <div class="form-group w-qty">
            <label>{{ $t('bom.target') }}</label>
            <n-input-number
              v-model:value="editTargetQty"
              size="small"
              :min="1"
            />
          </div>
        </div>

        <div class="form-row" v-if="editMode === 'continuous'">
          <div class="form-group flex-1">
            <label>{{ $t('bom.rounding') }}</label>
            <n-select
              v-model:value="editBalancing"
              :options="balancingOptions"
              size="small"
            />
          </div>
        </div>

        <div class="form-group">
          <label>{{ $t('bom.byproducts') }}</label>
          <n-select
            v-model:value="editByproduct"
            :options="byproductOptions"
            size="small"
          />
        </div>

        <n-button type="primary" size="small" block @click="runCalculation" :loading="bomStore.isCalculating">
          {{ $t('bom.calculate') }}
        </n-button>
      </div>

      <!-- Warnings -->
      <div v-if="warnings.length > 0" class="warnings-block">
        <div
          v-for="(w, i) in warnings"
          :key="i"
          class="warning-item"
          :class="'warn-' + w.type"
        >
          <span class="warn-icon">{{ warnIcon(w.type) }}</span>
          {{ w.message }}
        </div>
      </div>

      <!-- BOM Tree -->
      <div v-if="result" class="tree-block">
        <div class="section-label">{{ $t('bom.productionTree') }}</div>
        <div class="tree-root">
          <BomTreeNodeView
            :node="result.tree"
            :mode="result.request.mode"
            :depth="0"
            @highlight="(id: string | null) => bomStore.setHighlightedNodeId(id)"
          />
        </div>
      </div>

      <!-- Summary Table -->
      <div v-if="result" class="summary-block">
        <div class="section-label">{{ $t('bom.materialSummary') }}</div>
        <BomSummaryTable
          :rows="result.summary"
          :mode="result.request.mode"
          @highlight="(id: string | null) => bomStore.setHighlightedNodeId(id)"
        />
      </div>

      <!-- Empty state -->
      <div v-if="!result && !bomStore.isCalculating" class="empty-state">
        <p>{{ $t('bom.emptyState') }}</p>
        <p class="hint">{{ $t('bom.emptyStateHint') }}</p>
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  NDrawer, NDrawerContent,
  NInputNumber, NSelect, NButton,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { useBomStore } from '../store/bom-store';
import { useStore } from '../store';
import type { CalculationMode, BalancingStrategy, ByproductStrategy, BomWarning } from '../bom';
import BomTreeNodeView from './BomTreeNodeView.vue';
import BomSummaryTable from './BomSummaryTable.vue';

const { t } = useI18n();
const store = useStore();
const bomStore = useBomStore();

const editMode = ref<CalculationMode>('one-time');
const editTargetQty = ref(10);
const editBalancing = ref<BalancingStrategy>('integer-rounding');
const editByproduct = ref<ByproductStrategy>('ignore-annotate');

const modeOptions = computed(() => [
  { label: t('bom.modeOneTime'), value: 'one-time' as const },
  { label: t('bom.modeContinuous'), value: 'continuous' as const },
]);
const balancingOptions = computed(() => [
  { label: t('bom.roundingInteger'), value: 'integer-rounding' as const },
  { label: t('bom.roundingExact'), value: 'exact-decimal' as const },
]);
const byproductOptions = computed(() => [
  { label: t('bom.byproductIgnore'), value: 'ignore-annotate' as const },
  { label: t('bom.byproductOffset'), value: 'offset' as const },
  { label: t('bom.byproductIndependent'), value: 'independent-output' as const },
]);

const targetNodeName = computed(() => {
  const req = bomStore.pendingRequest;
  if (!req) return '—';
  const node = store.nodes.find(n => n.id === req.nodeId);
  return node?.name || req.nodeId;
});

const result = computed(() => bomStore.activeResult);
const warnings = computed(() => result.value?.warnings || []);

function warnIcon(type: BomWarning['type']): string {
  switch (type) {
    case 'cycle': return '↻';
    case 'catalyst_missing': return '⚠';
    case 'no_active_slot': return '⊘';
    case 'no_inputs': return '∅';
  }
}

function runCalculation() {
  const req = bomStore.pendingRequest;
  if (!req) return;
  bomStore.pendingRequest = {
    ...req,
    mode: editMode.value,
    targetQuantity: editTargetQty.value,
    balancingStrategy: editBalancing.value,
    byproductStrategy: editByproduct.value,
  };
  bomStore.calculateFromNode(req.nodeId, req.slotId);
}

function onUpdateShow(val: boolean) {
  if (!val) bomStore.panelVisible = false;
}

// Sync edit fields when pending request changes
watch(() => bomStore.pendingRequest, (req) => {
  if (req) {
    editMode.value = req.mode;
    editTargetQty.value = req.targetQuantity;
    editBalancing.value = req.balancingStrategy;
    editByproduct.value = req.byproductStrategy;
  }
}, { immediate: true });
</script>

<style scoped>
.config-block {
  background: var(--bg-surface);
  border: var(--border-width-md) solid var(--border-default);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  box-shadow: var(--shadow-card);
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: var(--border-width-md) solid var(--border-default);
}

.config-label {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  color: var(--text-muted);
}

.config-value {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 900;
  color: var(--text-primary);
}

.form-group {
  display: flex;
  flex-direction: column;
  margin-bottom: var(--spacing-md);
}

.form-group label {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.form-row {
  display: flex;
  gap: var(--spacing-md);
}

.flex-1 { flex: 1; }
.w-qty { width: 100px; }

.warnings-block {
  margin-bottom: var(--spacing-lg);
}

.warning-item {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  padding: 8px 12px;
  border: var(--border-width-md) solid var(--border-default);
  margin-bottom: 4px;
  box-shadow: var(--shadow-node);
}

.warn-cycle { border-left: 4px solid var(--accent-amber); }
.warn-catalyst_missing { border-left: 4px solid var(--accent-red); }
.warn-no_active_slot,
.warn-no_inputs { border-left: 4px solid var(--text-muted); }

.warn-icon { margin-right: 6px; }

.section-label {
  font-family: var(--font-ui);
  font-size: 16px;
  font-weight: 900;
  color: var(--text-main);
  text-transform: uppercase;
  margin-bottom: var(--spacing-md);
  border-left: var(--border-width-lg) solid var(--accent-amber);
  padding-left: var(--spacing-sm);
}

.tree-block, .summary-block {
  margin-bottom: var(--spacing-xl);
}

.tree-root {
  font-family: var(--font-mono);
  font-size: 12px;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  border: var(--border-width-md) dashed var(--border-default);
  color: var(--text-muted);
  font-family: var(--font-ui);
}
.empty-state strong {
  color: var(--text-primary);
}
.hint {
  font-size: 11px;
  margin-top: 8px;
  color: var(--text-dimmed);
}

/* Deep overrides */
:deep(.n-drawer-content) {
  border-left: var(--border-width-lg) solid var(--border-default);
  font-family: var(--font-ui);
}

:deep(.n-drawer-header) {
  background: var(--bg-header);
  border-bottom: var(--border-width-lg) solid var(--border-default);
}

:deep(.n-drawer-header__title) {
  font-family: var(--font-mono);
  font-weight: 900;
  text-transform: uppercase;
  font-size: 22px;
  letter-spacing: -1px;
}

:deep(.n-drawer) {
  box-shadow: -8px 0px 0px var(--border-default) !important;
  --n-body-color: var(--panel-bg);
  --n-text-color: var(--text-primary);
  --n-title-text-color: var(--text-primary);
}

:deep(.n-input-number), :deep(.n-select) {
  border-radius: var(--radius-sm) !important;
  border: var(--border-width-md) solid var(--border-default) !important;
  box-shadow: var(--shadow-node);
}

:deep(.n-button) {
  font-family: var(--font-mono);
  text-transform: uppercase;
  font-weight: 900;
  border-radius: var(--radius-sm) !important;
  margin-top: var(--spacing-sm);
}
</style>
