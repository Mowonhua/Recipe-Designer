<template>
  <div
    class="item-node"
    :class="{
      orphan: data.isOrphan,
      selected,
      'drag-target': isDragHovered,
    }"
    :style="{ '--node-color': data.color || '#3b82f6' }"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <Handle
      type="source"
      :position="Position.Top"
      id="source"
      class="source-handle"
    />

    <div class="node-label">
      <img v-if="iconIsImage" :src="data.icon" class="node-icon-img" />
      <span v-else-if="data.icon" class="node-icon-text">{{ data.icon }}</span>
      <span class="node-name">{{ data.name }}</span>
    </div>

    <!-- Collapsed state: invisible handles so Vue Flow knows the node has them -->
    <template v-if="!isDragHovered && !renameSlotId">
      <Handle
        v-for="slot in data.slots"
        :key="slot.id"
        type="target"
        :position="Position.Bottom"
        :id="slot.id"
        class="target-handle collapsed-dot"
        :style="collapsedDotStyle()"
        :connectable-start="false"
      />
      <Handle
        type="target"
        :position="Position.Bottom"
        id="__new_slot__"
        class="target-handle collapsed-dot"
        :style="collapsedNewDotStyle"
        :connectable-start="false"
      />
      <div v-if="data.slots.length > 0" class="target-bar"></div>
    </template>

    <!-- Expanded: slot picker panel with handles embedded in each row -->
    <div v-else class="slot-panel">
      <div class="panel-header">Drop on a slot</div>

      <div
        v-for="slot in data.slots"
        :key="slot.id"
        class="slot-row"
        :class="{ renaming: renameSlotId === slot.id }"
      >
        <template v-if="renameSlotId === slot.id">
          <input
            ref="renameInput"
            v-model="renameValue"
            class="rename-input"
            @keydown.enter.prevent="confirmRename"
            @keydown.escape.prevent="cancelRename"
            @blur="confirmRename"
          />
        </template>
        <template v-else>
          <span class="slot-name">{{ slot.name }}</span>
          <span class="slot-time">{{ slot.time }}s</span>
        </template>
        <Handle
          v-if="!renameSlotId"
          type="target"
          :position="Position.Bottom"
          :id="slot.id"
          class="slot-handle"
          :connectable-start="false"
        />
      </div>

      <div class="panel-divider"></div>

      <div class="slot-row new-slot-row">
        <span class="new-slot-plus">+</span>
        <span class="new-slot-label">New Slot</span>
        <Handle
          type="target"
          :position="Position.Bottom"
          id="__new_slot__"
          class="slot-handle new-slot-handle"
          :connectable-start="false"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject, nextTick, type Ref } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import type { ItemNode } from '../store';
import { useStore } from '../store';

const props = defineProps<{
  id: string;
  data: ItemNode & { isOrphan?: boolean };
  selected?: boolean;
}>();

const store = useStore();

const isHovered = ref(false);
const isConnecting = inject<Ref<boolean>>('isConnecting', ref(false));
const isDragHovered = ref(false);
const iconIsImage = computed(() => props.data.icon?.startsWith('data:image/') ?? false);

// New slot inline rename
const renameSlotId = ref<string | null>(null);
const renameValue = ref('');

function onMouseEnter() {
  isHovered.value = true;
  if (isConnecting.value) {
    isDragHovered.value = true;
  }
}
function onMouseLeave() {
  isHovered.value = false;
  isDragHovered.value = false;
}

watch(isConnecting, (v) => {
  if (!v && !renameSlotId.value) {
    isDragHovered.value = false;
  }
});

// Collapsed dot positioning — display all target endpoints at Center (50%)
function collapsedDotStyle(): Record<string, string> {
  return { left: '50%' };
}

const collapsedNewDotStyle = computed(() => ({ left: '50%' }));

// Detect new slots created via the "+ New Slot" handle (named '__new__') and enter rename mode
watch(() => props.data.slots.map(s => s.name), (names) => {
  const idx = names.indexOf('__new__');
  if (idx !== -1 && renameSlotId.value !== props.data.slots[idx]?.id) {
    const slot = props.data.slots[idx];
    renameSlotId.value = slot.id;
    renameValue.value = 'New Recipe';
    nextTick(() => {
      const input = document.querySelector('.slot-row.renaming .rename-input') as HTMLInputElement;
      input?.focus();
      input?.select();
    });
  }
}, { immediate: true });

function confirmRename() {
  const slotId = renameSlotId.value;
  if (!slotId) return;
  const name = renameValue.value.trim() || 'New Recipe';
  const slot = props.data.slots.find(s => s.id === slotId);
  if (slot) {
    slot.name = name;
    store.changeCounter++;
  }
  renameSlotId.value = null;
  renameValue.value = '';
  isDragHovered.value = false;
}

function cancelRename() {
  renameSlotId.value = null;
  renameValue.value = '';
  isDragHovered.value = false;
  store.undo();
  store.undo();
}
</script>

<style scoped>
.item-node {
  width: var(--node-width);
  min-height: var(--node-min-height);
  background: var(--bg-surface);
  border: var(--border-width-md) solid var(--border-default);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-md);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  box-shadow: var(--shadow-node);
  transition: all var(--transition-fast) var(--ease-smooth);
}

.item-node::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 10px;
  height: 100%;
  background-color: var(--node-color);
  mask-image: linear-gradient(to right, black, transparent);
  -webkit-mask-image: linear-gradient(to right, black, transparent);
}

.item-node:hover {
  transform: translate(-4px, -4px);
  box-shadow: var(--shadow-node-hover);
}

.item-node.selected {
  border-color: var(--node-color);
  background: var(--bg-hover);
}

.item-node.drag-target {
  border-color: var(--node-color);
  transform: scale(1.05);
}

.item-node.orphan {
  border-style: dotted;
  opacity: 0.6;
}

/* Node label */
.node-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-family: var(--font-ui), sans-serif;
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 1px;
}
.node-icon-img {
  width: 24px; height: 24px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  flex-shrink: 0;
  filter: grayscale(100%) contrast(1.2);
}
.item-node:hover .node-icon-img {
  filter: none;
}
.node-icon-text {
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
}
.node-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Collapsed target bar */
.target-bar {
  position: absolute;
  bottom: -4px;
  left: 20%;
  right: 20%;
  height: 8px;
  background: var(--node-color);
  border: var(--border-width-sm) solid var(--border-default);
  transition: all var(--transition-fast);
}

/* Collapsed invisible dots */
.collapsed-dot {
  position: absolute;
  bottom: -4px;
  width: 8px;
  height: 8px;
  opacity: 0;
  pointer-events: none;
}

/* Handles */
:deep(.vue-flow__handle) {
  transition: all var(--transition-fast) var(--ease-smooth);
}

/* Source handle */
:deep(.vue-flow__handle.source-handle) {
  width: 16px;
  height: 16px;
  background-color: var(--node-color);
  border: var(--border-width-md) solid var(--border-default);
  top: -8px;
  border-radius: var(--radius-sm); /* Using square handles for Bauhaus setup */
  z-index: 3;
}
:deep(.vue-flow__handle.source-handle:hover) {
  transform: rotate(45deg) scale(1.2);
}

/* Slot handle */
:deep(.vue-flow__handle.slot-handle) {
  position: absolute;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  transform: none !important;
  background: transparent;
  border: none;
  box-shadow: none;
  border-radius: var(--radius-sm);
  z-index: 1;
}
:deep(.vue-flow__handle.slot-handle:hover),
:deep(.vue-flow__handle.slot-handle.connecting) {
  background: var(--node-color);
  opacity: 0.1;
}

/* Slot panel */
.slot-panel {
  position: absolute;
  top: calc(100% + var(--border-width-md));
  left: -2px;
  right: -2px;
  background: var(--panel-bg);
  border: var(--border-width-md) solid var(--border-default);
  border-radius: var(--radius-sm);
  padding: var(--spacing-sm) 0;
  z-index: 10;
  box-shadow: var(--shadow-menu);
}

.panel-header {
  padding: var(--spacing-xs) var(--spacing-md);
  font-size: 10px;
  color: var(--text-dimmed);
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: bold;
}

.slot-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-md);
  cursor: pointer;
  border-left: var(--border-width-lg) solid transparent;
  transition: all var(--transition-fast);
  min-height: 32px;
}
.slot-row:hover {
  background: var(--bg-hover);
  border-left-color: var(--node-color);
}
.slot-row.renaming {
  background: var(--bg-input);
  border-left-color: var(--accent-blue);
}
.slot-name {
  flex: 1;
  font-size: 12px;
  color: var(--text-primary);
  font-weight: bold;
}
.slot-time {
  font-size: 10px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.panel-divider {
  height: var(--border-width-sm);
  background: var(--border-subtle);
  margin: var(--spacing-xs) var(--spacing-sm);
}

.new-slot-row {
  border-left-color: transparent;
}
.new-slot-row:hover {
  background: var(--bg-hover);
  border-left-color: var(--accent-green);
}
.new-slot-plus {
  font-size: 16px;
  font-weight: bold;
  color: var(--accent-green);
  flex-shrink: 0;
}
.new-slot-label {
  font-size: 12px;
  font-weight: bold;
  color: var(--accent-green);
}

.rename-input {
  flex: 1;
  background: var(--bg-input);
  border: var(--border-width-sm) solid var(--accent-blue);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  font-size: 12px;
  color: var(--text-primary);
  font-family: var(--font-ui);
  outline: none;
}
</style>
