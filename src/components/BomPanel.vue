<template>
  <n-drawer
    class="rd-drawer"
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
              @wheel.prevent="(e: WheelEvent) => onNumberWheel(() => editTargetQty, (v) => editTargetQty = v, 1, 1, e)"
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

        <div class="proliferator-config">
          <div class="form-group">
            <label>{{ $t('bom.proliferatorConfig') }}</label>
            <n-select
              v-model:value="editProliferatorsEnabled"
              :options="proliferatorEnabledOptions"
              size="small"
            />
          </div>
          <div v-if="editProliferatorsEnabled === 'enabled'" class="machine-proliferator-list">
            <div v-if="involvedMachines.length === 0" class="machine-proliferator-empty">
              {{ $t('bom.noMachinesForProliferators') }}
            </div>
            <div v-for="machine in involvedMachines" :key="machine.id" class="machine-proliferator-row">
              <span>{{ machine.name }}</span>
              <n-select
                :value="editProliferatorAssignments[machine.id] || ''"
                :options="proliferatorOptions"
                size="small"
                @update:value="(value: string) => setProliferatorAssignment(machine.id, value)"
              />
            </div>
          </div>
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
        <BomTreeCanvas
          :tree="result.tree"
          :mode="result.request.mode"
          @highlight="(id: string | null) => bomStore.setHighlightedNodeId(id)"
        />
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
import { onNumberWheel } from '../composables/useWheelNumber';
import {
  NDrawer, NDrawerContent,
  NInputNumber, NSelect, NButton,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { useBomStore } from '../store/bom-store';
import { useStore } from '../store';
import type { CalculationMode, BalancingStrategy, ByproductStrategy, BomTreeNode, BomWarning } from '../bom';
import BomTreeCanvas from './BomTreeCanvas.vue';
import BomSummaryTable from './BomSummaryTable.vue';

const { t } = useI18n();
const store = useStore();
const bomStore = useBomStore();

const editMode = ref<CalculationMode>('one-time');
const editTargetQty = ref(10);
const editBalancing = ref<BalancingStrategy>('integer-rounding');
const editByproduct = ref<ByproductStrategy>('ignore-annotate');
const editProliferatorsEnabled = ref<'disabled' | 'enabled'>('disabled');
const editProliferatorAssignments = ref<Record<string, string>>({});

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
const proliferatorEnabledOptions = computed(() => [
  { label: t('bom.proliferatorsDisabled'), value: 'disabled' },
  { label: t('bom.proliferatorsEnabled'), value: 'enabled' },
]);
const proliferatorOptions = computed(() => [
  { label: t('bom.noProliferator'), value: '' },
  ...store.proliferators.map(proliferator => ({
    label: `${itemName(proliferator.item_id)} x${formatNumber(proliferator.multiplier)}`,
    value: proliferator.id,
  })),
]);

const targetNodeName = computed(() => {
  const req = bomStore.pendingRequest;
  if (!req) return '—';
  const node = store.nodes.find(n => n.id === req.nodeId);
  return node?.name || req.nodeId;
});

const result = computed(() => bomStore.activeResult);
const warnings = computed(() => result.value?.warnings || []);
const involvedMachines = computed(() => {
  const ids = new Set<string>();

  function visit(nodeId: string, slotId: string | undefined) {
    const node = store.nodes.find(n => n.id === nodeId);
    const slot = node?.slots.find(s => s.id === slotId);
    if (slot?.machine_id) ids.add(slot.machine_id);
  }

  function walk(node: BomTreeNode) {
    visit(node.nodeId, node.slotId);
    for (const edge of node.inputs) {
      if (edge.child) walk(edge.child);
    }
  }

  if (result.value?.tree) {
    walk(result.value.tree);
  } else if (bomStore.pendingRequest) {
    visit(bomStore.pendingRequest.nodeId, bomStore.pendingRequest.slotId);
  }

  return store.machines.filter(machine =>
    ids.has(machine.id) &&
    (machine.slots || []).some(s => s.type === 'proliferator')
  );
});

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
  const proliferatorAssignments = editProliferatorsEnabled.value === 'enabled'
    ? Object.fromEntries(
      Object.entries(editProliferatorAssignments.value).filter(([, value]) => value),
    )
    : undefined;
  bomStore.pendingRequest = {
    ...req,
    mode: editMode.value,
    targetQuantity: editTargetQty.value,
    balancingStrategy: editBalancing.value,
    byproductStrategy: editByproduct.value,
    proliferatorAssignments,
  };
  bomStore.calculateFromNode(req.nodeId, req.slotId);
}

function onUpdateShow(val: boolean) {
  if (!val) bomStore.panelVisible = false;
}

function setProliferatorAssignment(machineId: string, value: string) {
  editProliferatorAssignments.value = {
    ...editProliferatorAssignments.value,
    [machineId]: value,
  };
}

function itemName(itemId: string): string {
  return store.nodes.find(n => n.id === itemId)?.name || itemId;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

// Sync edit fields when pending request changes
watch(() => bomStore.pendingRequest, (req) => {
  if (req) {
    editMode.value = req.mode;
    editTargetQty.value = req.targetQuantity;
    editBalancing.value = req.balancingStrategy;
    editByproduct.value = req.byproductStrategy;
    editProliferatorAssignments.value = { ...(req.proliferatorAssignments || {}) };
    editProliferatorsEnabled.value = Object.keys(editProliferatorAssignments.value).length > 0 ? 'enabled' : 'disabled';
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

:deep(.n-drawer-body-content) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tree-block {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  margin-bottom: var(--spacing-lg);
}

.summary-block {
  margin-bottom: var(--spacing-xl);
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

.proliferator-config {
  margin-bottom: var(--spacing-md);
  padding-top: var(--spacing-sm);
  border-top: var(--border-width-md) solid var(--border-default);
}

.machine-proliferator-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.machine-proliferator-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: var(--spacing-sm);
  align-items: center;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 900;
  color: var(--text-primary);
}

.machine-proliferator-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.machine-proliferator-empty {
  padding: var(--spacing-sm);
  border: var(--border-width-sm) dashed var(--border-default);
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}
</style>
