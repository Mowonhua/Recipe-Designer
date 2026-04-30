<template>
  <div :class="['group-node', { collapsed: data.collapsed }]">
    <!-- Header -->
    <div class="group-header" @dblclick.stop="toggleCollapse">
      <span class="group-icon">📦</span>
      <span class="group-name">{{ data.name }}</span>
      <span class="group-count">({{ data.children.length }} items)</span>
      <button type="button" class="group-toggle" @click.stop="toggleCollapse">
        {{ data.collapsed ? '↗ Expand' : '↙ Collapse' }}
      </button>
    </div>

    <!-- Collapsed summary -->
    <div v-if="data.collapsed" class="group-summary">
      <div class="summary-col">
        <div class="summary-label">Inputs</div>
        <div v-for="(io, i) in (data.summary_recipe?.inputs || [])" :key="'in-' + i" class="summary-item">
          <span>{{ getItemName(io.item_id) }}</span>
          <span class="summary-qty">×{{ io.quantity }}</span>
        </div>
        <div v-if="!data.summary_recipe?.inputs?.length" class="summary-empty">None</div>
      </div>
      <div class="summary-col">
        <div class="summary-label">Outputs</div>
        <div v-for="(io, i) in (data.summary_recipe?.outputs || [])" :key="'out-' + i" class="summary-item">
          <span>{{ getItemName(io.item_id) }}</span>
          <span class="summary-qty">×{{ io.quantity }}</span>
        </div>
        <div v-if="!data.summary_recipe?.outputs?.length" class="summary-empty">None</div>
      </div>
    </div>

    <!-- Footer hint -->
    <div class="group-footer">
      <span class="hint">Ctrl+Shift+G to disband</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useStore } from '../store';

const props = defineProps<{
  id: string;
  data: {
    name: string;
    children: string[];
    collapsed: boolean;
    summary_recipe?: {
      inputs: { item_id: string; quantity: number }[];
      outputs: { item_id: string; quantity: number }[];
      time: number;
    };
  };
}>();

const store = useStore();

function toggleCollapse() {
  store.toggleGroupCollapse(props.id);
}

function getItemName(itemId: string): string {
  return store.nodes.find(n => n.id === itemId)?.name || 'Unknown';
}
</script>

<style scoped>
.group-node {
  background: rgba(88,166,255,0.03);
  border: 1px dashed #58a6ff;
  border-radius: 12px;
  padding: 12px;
  min-width: 200px;
  font-family: var(--font-ui), sans-serif;
}
.group-node.collapsed {
  border-style: solid;
  border-color: #30363d;
  border-width: 2px;
  background: #161b22;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
}

.group-header {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 10px; cursor: pointer;
}
.group-icon { font-size: 14px; }
.group-name {
  font-size: 13px; font-weight: 600; color: #e6edf3;
}
.group-count { font-size: 9px; color: #8b949e; }
.group-toggle {
  margin-left: auto; font-size: 9px; color: #58a6ff;
  cursor: pointer; background: none; border: none;
  font-family: var(--font-ui), sans-serif;
}

.group-summary { display: flex; gap: 12px; }
.summary-col {
  flex: 1; background: #0d1117;
  border-radius: 6px; padding: 8px;
}
.summary-label {
  font-size: 9px; color: #8b949e; font-weight: 600;
  margin-bottom: 4px;
}
.summary-item {
  display: flex; justify-content: space-between;
  font-size: 9px; color: #e6edf3;
  font-family: var(--font-mono), monospace;
  padding: 2px 0;
}
.summary-qty { color: #8b949e; }
.summary-empty { font-size: 9px; color: #484f5a; font-style: italic; }

.group-footer {
  margin-top: 8px; padding-top: 6px;
  border-top: 1px solid #21262d;
}
.hint {
  font-size: 8px; color: #484f5a;
  font-family: var(--font-mono), monospace;
}
</style>
