<template>
  <div :class="['group-node', { collapsed: data.collapsed }]">
    <Handle v-if="data.collapsed" type="source" :position="Position.Top" id="source" class="source-handle" :connectable-end="false" />
    <Handle v-if="data.collapsed" type="target" :position="Position.Bottom" class="target-handle collapsed-dot" :style="{ left: '50%' }" :connectable-start="false"/>
    <!-- Header -->
    <div class="group-header" @dblclick.stop="toggleCollapse">
      <span class="group-icon">📦</span>
      <input
        v-if="isEditingName"
        v-model="editNameValue"
        class="group-name-input nodrag nopan"
        @blur="saveGroupName"
        @keyup.enter="saveGroupName"
        @keydown.stop
        ref="nameInput"
      />
      <span v-else class="group-name" @dblclick.stop="startEditName">{{ data.name }}</span>
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
import { ref, onMounted, nextTick } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { useStore } from '../store';

const props = defineProps<{
  id: string;
  data: {
    name: string;
    children: string[];
    collapsed: boolean;
    isEditingName?: boolean;
    summary_recipe?: {
      inputs: { item_id: string; quantity: number }[];
      outputs: { item_id: string; quantity: number }[];
      time: number;
    };
  };
}>();

const store = useStore();

const isEditingName = ref(props.data.isEditingName || false);
const editNameValue = ref(props.data.name);
const nameInput = ref<HTMLInputElement | null>(null);

function startEditName() {
  isEditingName.value = true;
  editNameValue.value = store.groups.find(g => g.id === props.id)?.name || props.data.name;
  nextTick(() => {
    nameInput.value?.focus();
    nameInput.value?.select();
  });
}

function saveGroupName() {
  if (isEditingName.value) {
    if (editNameValue.value.trim()) {
      store.updateGroupName(props.id, editNameValue.value.trim());
    }
    isEditingName.value = false;
  }
}

onMounted(() => {
  if (isEditingName.value) {
    nextTick(() => {
      nameInput.value?.focus();
      nameInput.value?.select();
    });
  }
});

function toggleCollapse() {
  if (isEditingName.value) return; // Prevent toggle when clicking to edit
  store.toggleGroupCollapse(props.id);
}

function getItemName(itemId: string): string {
  return store.nodes.find(n => n.id === itemId)?.name || 'Unknown';
}
</script>

<style scoped>
.group-node {
  background: rgba(88,166,255,0.03);
  border: 1px dashed var(--accent-link);
  border-radius: var(--radius-2xl);
  padding: 12px;
  min-width: 200px;
  height: 100%;
  box-sizing: border-box;
  font-family: var(--font-ui), sans-serif;
}
.group-node.collapsed {
  border-style: solid;
  border-color: var(--border-default);
  border-width: 2px;
  height: auto;
  background: var(--bg-surface);
  box-shadow: var(--shadow-group);
}

/* Handles */
:deep(.vue-flow__handle) {
  transition: all var(--transition-fast) var(--ease-smooth);
}

:deep(.vue-flow__handle.source-handle) {
  width: 16px;
  height: 16px;
  background-color: var(--accent-link, #4488ff);
  border: var(--border-width-md, 2px) solid var(--border-default);
  top: -6px;
  border-radius: var(--radius-sm); /* Using square handles for Bauhaus setup */
  z-index: 3;
}

:deep(.vue-flow__handle.source-handle:hover) {
  transform: rotate(45deg) scale(1.2);
}

:deep(.vue-flow__handle.target-handle) {
  width: 60%;
  height: 8px;
  border-radius: 0;
  background-color: var(--accent-link, #4488ff);
  border: var(--border-width-md, 2px) solid var(--border-default);
  bottom: 4px;
}

.group-header {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 10px; cursor: pointer;
}
.group-icon { font-size: 14px; }
.group-name {
  font-size: 13px; font-weight: 600; color: var(--text-primary);
}
.group-name-input {
  font-size: 13px; font-weight: 600; color: var(--text-primary);
  background: var(--bg-input);
  border: 1px solid var(--border-default);
  outline: none;
  min-width: 60px;
  max-width: 120px;
  padding: 0 4px;
}
.group-count { font-size: 9px; color: var(--text-muted); }
.group-toggle {
  margin-left: auto; font-size: 9px; color: var(--accent-link);
  cursor: pointer; background: none; border: none;
  font-family: var(--font-ui), sans-serif;
}

.group-summary { display: flex; gap: 12px; }
.summary-col {
  flex: 1; background: var(--bg-deep);
  border-radius: var(--radius-md); padding: 8px;
}
.summary-label {
  font-size: 9px; color: var(--text-muted); font-weight: 600;
  margin-bottom: 4px;
}
.summary-item {
  display: flex; justify-content: space-between;
  font-size: 9px; color: var(--text-primary);
  font-family: var(--font-mono), monospace;
  padding: 2px 0;
}
.summary-qty { color: var(--text-muted); }
.summary-empty { font-size: 9px; color: var(--text-disabled); font-style: italic; }

.group-footer {
  margin-top: 8px; padding-top: 6px;
  border-top: 1px solid var(--border-subtle);
}
.hint {
  font-size: 8px; color: var(--text-disabled);
  font-family: var(--font-mono), monospace;
}
</style>
