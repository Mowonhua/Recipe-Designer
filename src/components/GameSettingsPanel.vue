<template>
  <n-modal :show="visible" preset="card" :title="$t('gameSettings.title')" class="game-settings-modal" @update:show="emit('update:visible', $event)">
    <div class="game-settings">
      <div class="game-tabs" role="tablist">
        <button
          type="button"
          class="game-tab"
          :class="{ active: activeTab === 'effects' }"
          @click="activeTab = 'effects'"
        >
          {{ $t('gameSettings.globalEffects') }}
        </button>
        <button
          type="button"
          class="game-tab"
          :class="{ active: activeTab === 'proliferators' }"
          @click="activeTab = 'proliferators'"
        >
          {{ $t('gameSettings.proliferators') }}
        </button>
      </div>

      <div class="game-panel">
        <template v-if="activeTab === 'effects'">
          <div v-if="store.global_effects.length === 0" class="game-empty">
            {{ $t('gameSettings.noEffects') }}
          </div>
          <div class="accordion-list">
            <div v-for="effect in store.global_effects" :key="effect.id" class="accordion-row">
              <div class="accordion-summary" @click="toggleExpanded(effect.id)">
                <button
                  type="button"
                  class="enable-block"
                  :class="{ enabled: effect.enabled !== false }"
                  :title="$t(effect.enabled !== false ? 'gameSettings.enabled' : 'gameSettings.disabled')"
                  @click.stop="store.updateGlobalEffect(effect.id, { enabled: effect.enabled === false })"
                ></button>
                <span class="summary-name">{{ effect.name || $t('gameSettings.unnamedEffect') }}</span>
                <span class="summary-chip">{{ effectTypeLabel(effect.type) }}</span>
                <span class="summary-value">x{{ formatNumber(effect.multiplier) }}</span>
                <button type="button" class="icon-btn danger" :title="$t('dict.delete')" @click.stop="requestDeleteEffect(effect.id)">
                  <Trash2 :size="14" />
                </button>
              </div>
              <div v-if="expandedId === effect.id" class="accordion-body">
                <div class="form-row">
                  <div class="form-group flex-1">
                    <label>{{ $t('gameSettings.name') }}</label>
                    <n-input
                      :value="effect.name"
                      size="small"
                      @update:value="(value: string) => store.updateGlobalEffect(effect.id, { name: value })"
                    />
                  </div>
                  <div class="form-group flex-1">
                    <label>{{ $t('gameSettings.source') }}</label>
                    <n-select
                      :value="effect.source"
                      :options="sourceOptions"
                      size="small"
                      @update:value="(value: any) => store.updateGlobalEffect(effect.id, { source: value })"
                    />
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group flex-1">
                    <label>{{ $t('gameSettings.effectType') }}</label>
                    <n-select
                      :value="effect.type"
                      :options="effectTypeOptions"
                      size="small"
                      @update:value="(value: any) => store.updateGlobalEffect(effect.id, { type: value, target_tags: [] })"
                    />
                  </div>
                  <div class="form-group flex-1">
                    <label>{{ $t('gameSettings.multiplier') }}</label>
                    <n-input-number
                      :value="effect.multiplier"
                      size="small"
                      :min="0.05"
                      :max="100"
                      :step="0.05"
                      @update:value="(value: number | null) => store.updateGlobalEffect(effect.id, { multiplier: value || 0.05 })"
                    />
                  </div>
                </div>
                <div class="form-group">
                  <label>{{ $t('gameSettings.targetTags') }}</label>
                  <n-select
                    :value="effect.target_tags"
                    multiple
                    filterable
                    :options="targetTagOptions(effect.type)"
                    size="small"
                    @update:value="(value: string[]) => store.updateGlobalEffect(effect.id, { target_tags: value })"
                  />
                </div>
              </div>
            </div>
          </div>
          <button type="button" class="add-row-btn" @click="addEffect">
            <Plus :size="14" /> {{ $t('gameSettings.addEffect') }}
          </button>
        </template>

        <template v-else>
          <div v-if="store.proliferators.length === 0" class="game-empty">
            {{ $t('gameSettings.noProliferators') }}
          </div>
          <div class="accordion-list">
            <div v-for="proliferator in store.proliferators" :key="proliferator.id" class="accordion-row">
              <div class="accordion-summary" @click="toggleExpanded(proliferator.id)">
                <span class="summary-color" :style="{ background: itemColor(proliferator.item_id) }"></span>
                <span class="summary-name">{{ itemName(proliferator.item_id) }}</span>
                <span class="summary-chip">x{{ formatNumber(proliferator.multiplier) }}</span>
                <span class="summary-value">{{ proliferator.consumption_per_cycle }}/{{ $t('gameSettings.cycle') }}</span>
                <button type="button" class="icon-btn danger" :title="$t('dict.delete')" @click.stop="requestDeleteProliferator(proliferator.id)">
                  <Trash2 :size="14" />
                </button>
              </div>
              <div v-if="expandedId === proliferator.id" class="accordion-body">
                <div class="form-group">
                  <label>{{ $t('gameSettings.item') }}</label>
                  <n-select
                    :value="proliferator.item_id"
                    filterable
                    :options="itemOptions(proliferator.id)"
                    size="small"
                    @update:value="(value: string) => store.updateProliferator(proliferator.id, { item_id: value })"
                  />
                </div>
                <div class="form-row">
                  <div class="form-group flex-1">
                    <label>{{ $t('gameSettings.multiplier') }}</label>
                    <n-input-number
                      :value="proliferator.multiplier"
                      size="small"
                      :min="1"
                      :max="10"
                      :step="0.05"
                      @update:value="(value: number | null) => store.updateProliferator(proliferator.id, { multiplier: value || 1 })"
                    />
                  </div>
                  <div class="form-group flex-1">
                    <label>{{ $t('gameSettings.consumption') }}</label>
                    <n-input-number
                      :value="proliferator.consumption_per_cycle"
                      size="small"
                      :min="1"
                      :step="1"
                      @update:value="(value: number | null) => store.updateProliferator(proliferator.id, { consumption_per_cycle: Math.max(1, Math.round(value || 1)) })"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button type="button" class="add-row-btn" @click="addProliferator">
            <Plus :size="14" /> {{ $t('gameSettings.addProliferator') }}
          </button>
        </template>
      </div>
    </div>

    <ConfirmDialog
      :visible="confirmDialog.visible"
      :title="$t('dialog.confirm')"
      :message="confirmDialog.message"
      :confirm-text="$t('dict.delete')"
      confirm-danger
      @confirm="confirmDelete"
      @cancel="closeConfirm"
    />
  </n-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { NInput, NInputNumber, NModal, NSelect } from 'naive-ui';
import { Plus, Trash2 } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { useStore, type GlobalEffect } from '../store';
import ConfirmDialog from './ConfirmDialog.vue';

defineProps<{ visible: boolean }>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const { t } = useI18n();
const store = useStore();

const activeTab = ref<'effects' | 'proliferators'>('effects');
const expandedId = ref<string | null>(null);
const confirmDialog = reactive({
  visible: false,
  message: '',
  target: null as null | { type: 'effect' | 'proliferator'; id: string },
});

const sourceOptions = computed(() => [
  { label: t('gameSettings.sourceSkill'), value: 'skill' },
  { label: t('gameSettings.sourceTreasure'), value: 'treasure' },
  { label: t('gameSettings.sourceResearch'), value: 'research' },
  { label: t('gameSettings.sourceOther'), value: 'other' },
]);

const effectTypeOptions = computed(() => [
  { label: t('gameSettings.recipeYield'), value: 'recipe_yield' },
  { label: t('gameSettings.machineSpeed'), value: 'machine_speed' },
]);

function toggleExpanded(id: string) {
  expandedId.value = expandedId.value === id ? null : id;
}

function addEffect() {
  const effect = store.addGlobalEffect({ name: t('gameSettings.newEffect') });
  activeTab.value = 'effects';
  expandedId.value = effect.id;
}

function addProliferator() {
  const proliferator = store.addProliferator();
  activeTab.value = 'proliferators';
  expandedId.value = proliferator.id;
}

function requestDeleteEffect(id: string) {
  confirmDialog.visible = true;
  confirmDialog.message = t('gameSettings.deleteEffectConfirm');
  confirmDialog.target = { type: 'effect', id };
}

function requestDeleteProliferator(id: string) {
  confirmDialog.visible = true;
  confirmDialog.message = t('gameSettings.deleteProliferatorConfirm');
  confirmDialog.target = { type: 'proliferator', id };
}

function confirmDelete() {
  if (confirmDialog.target?.type === 'effect') {
    store.deleteGlobalEffect(confirmDialog.target.id);
  } else if (confirmDialog.target?.type === 'proliferator') {
    store.deleteProliferator(confirmDialog.target.id);
  }
  closeConfirm();
}

function closeConfirm() {
  confirmDialog.visible = false;
  confirmDialog.target = null;
}

function targetTagOptions(type: GlobalEffect['type']) {
  const tags = type === 'recipe_yield'
    ? store.tag_pool.recipe_tags
    : store.tag_pool.machine_tags;
  return tags.map(tag => ({ label: tag, value: tag }));
}

function itemOptions(currentId: string) {
  const usedByOther = new Set(
    store.proliferators
      .filter(p => p.id !== currentId)
      .map(p => p.item_id),
  );
  return store.nodes.map(node => ({
    label: `${node.icon ? `${node.icon} ` : ''}${node.name}`,
    value: node.id,
    disabled: usedByOther.has(node.id),
  }));
}

function itemName(itemId: string): string {
  return store.nodes.find(node => node.id === itemId)?.name || t('drawer.unknown');
}

function itemColor(itemId: string): string {
  return store.nodes.find(node => node.id === itemId)?.color || 'var(--text-muted)';
}

function effectTypeLabel(type: GlobalEffect['type']): string {
  return type === 'recipe_yield' ? t('gameSettings.recipeYield') : t('gameSettings.machineSpeed');
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
</script>

<style scoped>
.game-settings {
  display: grid;
  grid-template-columns: 128px 1fr;
  height: 520px;
  border: var(--border-width-md) solid var(--border-default);
  background: var(--panel-bg);
}

.game-tabs {
  display: flex;
  flex-direction: column;
  border-right: var(--border-width-lg) solid var(--border-default);
  background: var(--bg-header);
}

.game-tab {
  min-height: 72px;
  padding: var(--spacing-sm);
  border: 0;
  border-bottom: var(--border-width-md) solid var(--border-default);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.game-tab.active {
  background: var(--accent-amber);
  color: var(--border-default);
}

.game-panel {
  min-width: 0;
  overflow-y: auto;
  padding: var(--spacing-md);
}

.accordion-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.accordion-row {
  border: var(--border-width-md) solid var(--border-default);
  background: var(--bg-surface);
  box-shadow: var(--shadow-node);
}

.accordion-summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto auto;
  gap: var(--spacing-sm);
  align-items: center;
  padding: var(--spacing-sm);
  cursor: pointer;
}

.enable-block,
.summary-color {
  width: 18px;
  height: 18px;
  border: var(--border-width-md) solid var(--border-default);
  background: var(--accent-red);
}

.enable-block {
  cursor: pointer;
}

.enable-block.enabled {
  background: var(--accent-green);
}

.summary-name,
.summary-chip,
.summary-value {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 900;
  color: var(--text-primary);
}

.summary-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-chip {
  padding: 2px 6px;
  border: var(--border-width-sm) solid var(--border-default);
  background: var(--panel-bg);
}

.summary-value {
  color: var(--text-muted);
}

.accordion-body {
  padding: var(--spacing-md);
  border-top: var(--border-width-md) solid var(--border-default);
  background: var(--panel-bg);
}

.icon-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: var(--border-width-md) solid var(--border-default);
  background: var(--bg-surface);
  color: var(--text-primary);
  cursor: pointer;
}

.icon-btn.danger {
  color: var(--accent-red);
}

.add-row-btn {
  margin-top: var(--spacing-md);
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: 8px 12px;
  border: var(--border-width-md) dashed var(--border-default);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
  cursor: pointer;
}

.game-empty {
  padding: var(--spacing-xl);
  text-align: center;
  border: var(--border-width-md) dashed var(--border-default);
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}
</style>

<style>
.game-settings-modal {
  width: 800px;
  max-width: calc(100vw - 32px);
  --n-border-radius: var(--radius-sm);
  --n-color: var(--panel-bg);
  --n-text-color: var(--text-primary);
  --n-title-text-color: var(--text-primary);
  box-shadow: var(--shadow-modal);
}
</style>
