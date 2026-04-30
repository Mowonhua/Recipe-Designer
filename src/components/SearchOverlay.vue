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
          placeholder="Search nodes, slots, machines..."
          @keydown="onKeydown"
        />
        <kbd class="shortcut-hint">Esc</kbd>
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
          {{ query ? 'No results' : 'Type to search...' }}
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <span>↑↓ Navigate</span>
        <span>Enter Select & Fly to</span>
        <span>Esc Close</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { useStore } from '../store';

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

const tabs = [
  { key: 'all', label: 'All' },
  { key: 'item', label: 'Items' },
  { key: 'machine', label: 'Machines' },
  { key: 'slot', label: 'Slots' },
];

const allResults = computed<SearchResult[]>(() => {
  const q = query.value.toLowerCase().trim();
  const results: SearchResult[] = [];

  if (activeTab.value === 'all' || activeTab.value === 'item') {
    for (const node of store.nodes) {
      if (!q || node.name.toLowerCase().includes(q) || node.tags.some(t => t.toLowerCase().includes(q))) {
        results.push({ type: 'Item', id: node.id, name: node.name, color: node.color, nodeId: node.id });
      }
    }
  }

  if (activeTab.value === 'all' || activeTab.value === 'machine') {
    for (const machine of store.machines) {
      if (!q || machine.name.toLowerCase().includes(q) || machine.tags.some(t => t.toLowerCase().includes(q))) {
        results.push({ type: 'Machine', id: machine.id, name: machine.name, color: '#64748b' });
      }
    }
  }

  if (activeTab.value === 'all' || activeTab.value === 'slot') {
    for (const node of store.nodes) {
      for (const slot of node.slots) {
        if (!q || slot.name.toLowerCase().includes(q) || slot.tags.some(t => t.toLowerCase().includes(q))) {
          results.push({
            type: 'Slot',
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
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
}

.search-modal {
  width: 480px;
  max-height: 70vh;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-modal);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-family: var(--font-ui);
}

.input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--panel-border);
}

.search-icon { font-size: 14px; }

.search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text-main);
  font-size: 15px;
  font-family: var(--font-ui);
}

.search-input::placeholder { color: var(--text-dimmed); }

.shortcut-hint {
  background: var(--bg-hover);
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  font-size: 10px;
  font-family: var(--font-mono);
}

.filter-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--panel-border);
}

.filter-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
  font-family: var(--font-ui);
  transition: background var(--transition-fast);
}
.filter-btn:hover { background: var(--bg-hover); }
.filter-btn.active {
  background: var(--accent-blue);
  color: #fff;
}

.results {
  flex: 1;
  overflow-y: auto;
  max-height: 350px;
}

.group-header {
  padding: 6px 14px;
  font-size: 10px;
  color: var(--text-dimmed);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  cursor: pointer;
  transition: background var(--transition-fast);
}
.result-row:hover,
.result-row.highlighted {
  background: var(--bg-hover);
}

.result-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
}

.result-name {
  color: var(--text-main);
  font-size: 13px;
  flex: 1;
}

.result-subtitle {
  color: var(--text-dimmed);
  font-size: 11px;
  margin-left: -6px;
}

.result-type {
  color: var(--text-dimmed);
  font-size: 11px;
}

.no-results {
  padding: 32px 14px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.footer {
  display: flex;
  gap: 16px;
  padding: 6px 14px;
  border-top: 1px solid var(--panel-border);
  font-size: 10px;
  color: var(--text-dimmed);
  font-family: var(--font-mono);
}
</style>
