<template>
  <div class="backdrop" @click.self="$emit('close')">
    <div class="search-modal" @click.stop>
      <!-- Input -->
      <div class="input-row">
        <span class="search-icon">🔍</span>
        <input
          ref="inputRef"
          v-model="query"
          class="search-input"
          :placeholder="$t('search.placeholder')"
          @keydown="onKeydown"
        />
        <kbd class="shortcut-hint">ESC</kbd>
      </div>

      <!-- Filter tabs -->
      <div class="filter-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="['filter-btn', { active: activeTab === tab.key }]"
          @click="activeTab = tab.key; selectedIndex = 0"
        >{{ tab.label }}</button>
      </div>

      <!-- Results -->
      <div class="results" ref="resultsRef">
        <template v-if="groupedResults.length">
          <div v-for="group in groupedResults" :key="group.type">
            <div class="group-header">{{ group.type }}</div>
            <div
              v-for="(result, i) in group.items"
              :key="result.id"
              :class="['result-row', { highlighted: getGlobalIndex(group, i) === selectedIndex }]"
              @click="select(result)"
              @mouseenter="selectedIndex = getGlobalIndex(group, i)"
            >
              <span class="result-dot" :style="{ background: result.color || '#64748b' }"></span>
              <span class="result-name">{{ result.name }}</span>
              <span v-if="result.subtitle" class="result-subtitle">{{ result.subtitle }}</span>
              <span class="result-type">{{ result.type }}</span>
            </div>
          </div>
        </template>
        <div v-else class="no-results">
          {{ query ? $t('search.noResults') : $t('search.typeToSearch') }}
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <span>{{ $t('search.footerNav') }}</span>
        <span>{{ $t('search.footerEnter') }}</span>
        <span>{{ $t('search.footerEsc') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useStore } from '../store';

const { t } = useI18n();

const emit = defineEmits<{
  close: [];
}>();

interface SearchResult {
  type: string;
  id: string;
  name: string;
  subtitle?: string;
  color?: string;
  nodeId?: string;
}

const store = useStore();
const query = ref('');
const activeTab = ref('all');
const selectedIndex = ref(0);
const inputRef = ref<HTMLInputElement>();

const tabs = computed(() => [
  { key: 'all', label: t('search.tabAll') },
  { key: 'item', label: t('search.tabItems') },
  { key: 'machine', label: t('search.tabMachines') },
  { key: 'slot', label: t('search.tabSlots') },
]);

const allResults = computed<SearchResult[]>(() => {
  const q = query.value.toLowerCase().trim();
  const results: SearchResult[] = [];

  if (activeTab.value === 'all' || activeTab.value === 'item') {
    for (const node of store.nodes) {
      if (!q || node.name.toLowerCase().includes(q) || node.tags.some(t => t.toLowerCase().includes(q))) {
        results.push({ type: t('search.typeItem'), id: node.id, name: node.name, color: node.color, nodeId: node.id });
      }
    }
  }

  if (activeTab.value === 'all' || activeTab.value === 'machine') {
    for (const machine of store.machines) {
      if (!q || machine.name.toLowerCase().includes(q) || machine.tags.some(t => t.toLowerCase().includes(q))) {
        results.push({ type: t('search.typeMachine'), id: machine.id, name: machine.name, color: '#64748b' });
      }
    }
  }

  if (activeTab.value === 'all' || activeTab.value === 'slot') {
    for (const node of store.nodes) {
      for (const slot of node.slots) {
        if (!q || slot.name.toLowerCase().includes(q) || slot.tags.some(t => t.toLowerCase().includes(q))) {
          results.push({
            type: t('search.typeSlot'),
            id: slot.id,
            name: slot.name,
            subtitle: node.name,
            color: '#10b981',
            nodeId: node.id,
          });
        }
      }
    }
  }

  return results;
});

interface ResultGroup {
  type: string;
  items: SearchResult[];
}

const groupedResults = computed<ResultGroup[]>(() => {
  const groups: Record<string, SearchResult[]> = {};
  for (const r of allResults.value) {
    (groups[r.type] ||= []).push(r);
  }
  return Object.entries(groups).map(([type, items]) => ({ type, items }));
});

// Flattened index for keyboard nav
function getGlobalIndex(group: ResultGroup, i: number): number {
  let offset = 0;
  for (const g of groupedResults.value) {
    if (g.type === group.type) return offset + i;
    offset += g.items.length;
  }
  return i;
}

function getResultAt(flatIndex: number): SearchResult | null {
  let offset = 0;
  for (const g of groupedResults.value) {
    if (flatIndex < offset + g.items.length) {
      return g.items[flatIndex - offset];
    }
    offset += g.items.length;
  }
  return null;
}

const totalResults = computed(() => {
  let count = 0;
  for (const g of groupedResults.value) count += g.items.length;
  return count;
});

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndex.value = Math.min(selectedIndex.value + 1, totalResults.value - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const result = getResultAt(selectedIndex.value);
    if (result) select(result);
  } else if (e.key === 'Escape') {
    emit('close');
  }
}

function select(result: SearchResult) {
  query.value = '';
  activeTab.value = 'all';
  // Fly to node: emit a custom event or use a callback
  const nodeId = result.nodeId || result.id;
  const node = store.nodes.find(n => n.id === nodeId);
  if (node) {
    // Dispatch a custom event that Editor listens to
    window.dispatchEvent(new CustomEvent('search-fly-to', { detail: { x: node.position.x, y: node.position.y } }));
  }
}

watch(activeTab, () => { selectedIndex.value = 0; });
watch(query, () => { selectedIndex.value = 0; });

onMounted(async () => {
  await nextTick();
  inputRef.value?.focus();
});
</script>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  font-family: var(--font-ui);
}

.search-modal {
  width: 520px;
  max-height: 72vh;
  background: var(--panel-bg);
  border: var(--border-width-lg) solid var(--border-default);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-modal), 0 0 32px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
}

.input-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  background: var(--bg-header);
  border-bottom: var(--border-width-md) solid var(--border-default);
  position: relative;
}

.input-row::after {
  content: '';
  position: absolute;
  bottom: 0;
  right: 0;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 0 0 12px 12px;
  border-color: transparent transparent var(--border-default) transparent;
}

.search-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: var(--bg-input);
  border: var(--border-width-md) solid var(--border-default);
  outline: none;
  color: var(--text-primary);
  font-size: 15px;
  font-family: var(--font-ui);
  font-weight: 600;
  padding: var(--spacing-sm) var(--spacing-md);
  box-sizing: border-box;
  border-radius: var(--radius-sm);
  transition: box-shadow var(--transition-fast);
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-input:focus {
  box-shadow: inset 0 0 0 2px var(--accent-blue), var(--shadow-card);
}

.shortcut-hint {
  background: var(--bg-deep);
  color: var(--text-primary);
  border: var(--border-width-sm) solid var(--border-default);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  font-size: 11px;
  font-family: var(--font-mono);
  font-weight: 700;
  text-transform: uppercase;
  flex-shrink: 0;
}

.filter-tabs {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--bg-deep);
  border-bottom: var(--border-width-md) solid var(--border-default);
  overflow-x: auto;
}

.filter-btn {
  background: transparent;
  border: var(--border-width-sm) solid var(--border-default);
  color: var(--text-muted);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
  font-family: var(--font-mono);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all var(--transition-fast);
  white-space: nowrap;
  flex-shrink: 0;
}

.filter-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.filter-btn.active {
  background: var(--text-primary);
  color: var(--bg-color);
  border-color: var(--text-primary);
}

.results {
  flex: 1;
  overflow-y: auto;
  max-height: 350px;
  background: var(--bg-color);
  padding: var(--spacing-md);
}

.group-header {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: 12px;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 900;
  font-family: var(--font-mono);
  margin-top: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
  border-left: var(--border-width-lg) solid var(--accent-amber);
  padding-left: var(--spacing-sm);
}

.group-header:first-of-type {
  margin-top: 0;
}

.result-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  cursor: pointer;
  border-radius: var(--radius-sm);
  border: var(--border-width-sm) solid transparent;
  background: var(--panel-bg);
  margin-bottom: var(--spacing-sm);
  box-shadow: var(--shadow-node);
  transition: all var(--transition-fast) var(--ease-smooth);
  position: relative;
}

.result-row:hover {
  transform: translate(-2px, -2px);
  box-shadow: var(--shadow-node-hover);
  background: var(--bg-hover);
}

.result-row.highlighted {
  background: var(--accent-blue);
  color: var(--bg-input);
  border-color: var(--border-default);
}

.result-row.highlighted .result-name,
.result-row.highlighted .result-subtitle,
.result-row.highlighted .result-type {
  color: var(--bg-input);
}

.result-dot {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  border: var(--border-width-md) solid var(--border-default);
}

.result-row.highlighted .result-dot {
  border-color: var(--bg-input);
}

.result-name {
  color: var(--text-main);
  font-size: 13px;
  font-weight: 700;
  flex: 1;
}

.result-subtitle {
  color: var(--text-muted);
  font-size: 12px;
  font-family: var(--font-mono);
  margin-left: auto;
  margin-right: var(--spacing-md);
}

.result-type {
  color: var(--text-dimmed);
  font-size: 11px;
  font-family: var(--font-mono);
  font-weight: 800;
  text-transform: uppercase;
  background: var(--bg-deep);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}

.no-results {
  padding: var(--spacing-xl);
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 600;
}

.footer {
  display: flex;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-top: var(--border-width-md) solid var(--border-default);
  background: var(--bg-deep);
  font-size: 12px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
