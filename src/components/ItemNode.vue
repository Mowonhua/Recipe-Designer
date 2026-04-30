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
  background: linear-gradient(135deg, color-mix(in srgb, var(--node-color) 8%, #1f222d), color-mix(in srgb, var(--node-color) 2%, #15171d));
  border: 1px solid color-mix(in srgb, var(--node-color) 20%, #2a2d36);
  border-top: 1px solid color-mix(in srgb, var(--node-color) 50%, #444);
  border-radius: var(--radius-xl);
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  box-shadow: inset 0 1px 1px rgb(255 255 255 / 0.05), var(--shadow-node);
  transition: all var(--transition-slow) var(--ease-bounce);
}

.item-node:hover {
  border-color: color-mix(in srgb, var(--node-color) 60%, #444);
  box-shadow: inset 0 1px 1px rgb(255 255 255 / 0.08), var(--shadow-node-hover);
  transform: translateY(-2px);
}

.item-node.selected {
  background: linear-gradient(135deg, color-mix(in srgb, var(--node-color) 12%, #222631), color-mix(in srgb, var(--node-color) 5%, #181a21));
  border-color: var(--node-color);
  box-shadow: inset 0 1px 1px rgb(255 255 255 / 0.1),
              0 0 0 2px color-mix(in srgb, var(--node-color) 25%, transparent),
              0 8px 20px color-mix(in srgb, var(--node-color) 20%, transparent);
}

.item-node.drag-target {
  border-color: color-mix(in srgb, var(--node-color) 70%, #444);
  box-shadow: inset 0 1px 1px rgb(255 255 255 / 0.08),
              0 0 0 3px color-mix(in srgb, var(--node-color) 20%, transparent),
              0 8px 28px color-mix(in srgb, var(--node-color) 18%, transparent);
}

.item-node.orphan {
  border-style: dashed;
  opacity: 0.5;
}

/* Node label */
.node-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-ui), sans-serif;
  font-size: 13.5px;
  font-weight: 500;
  color: #f8fafc;
  letter-spacing: 0.2px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}
.node-icon-img {
  width: 18px; height: 18px;
  border-radius: 3px;
  object-fit: cover;
  flex-shrink: 0;
  opacity: 0.9;
}
.node-icon-text {
  font-size: 15px;
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
  bottom: -3px;
  left: 25%;
  right: 25%;
  height: 6px;
  background: #0b0c10;
  border: 1px solid color-mix(in srgb, var(--node-color) 25%, #333a45);
  border-radius: 3px;
  transition: all var(--transition-normal);
}
.item-node:hover .target-bar {
  border-color: color-mix(in srgb, var(--node-color) 45%, #444);
}

/* Collapsed invisible dots — just to register handles with Vue Flow */
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
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Source handle */
:deep(.vue-flow__handle.source-handle) {
  width: 10px;
  height: 10px;
  background-color: var(--node-color, #94a3b8);
  border: 2px solid var(--bg-grid);
  top: -5px;
  border-radius: var(--radius-full);
  z-index: 3;
}
:deep(.vue-flow__handle.source-handle:hover) {
  transform: scale(1.3);
  box-shadow: 0 0 6px var(--node-color);
}

/* Slot handle — embedded inside each panel row, covers it exactly */
:deep(.vue-flow__handle.slot-handle) {
  position: absolute;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  transform: none !important;
  background: transparent;
  border: none;
  box-shadow: none;
  border-radius: var(--radius-md);
  z-index: 1;
}
:deep(.vue-flow__handle.slot-handle:hover),
:deep(.vue-flow__handle.slot-handle.connecting) {
  background: color-mix(in srgb, var(--node-color) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--node-color) 25%, transparent);
}

/* New-slot handle embedded in panel */
:deep(.vue-flow__handle.slot-handle.new-slot-handle:hover),
:deep(.vue-flow__handle.slot-handle.new-slot-handle.connecting) {
  background: color-mix(in srgb, var(--accent-green) 10%, transparent);
  border-color: color-mix(in srgb, var(--accent-green) 35%, transparent);
}

/* Slot panel */
.slot-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: -8px;
  right: -8px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: 6px 0;
  z-index: 10;
  box-shadow: var(--shadow-card);
  animation: panelIn 0.15s var(--ease-smooth);
}
@keyframes panelIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.panel-header {
  padding: 4px 10px 6px;
  font-size: 9px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.slot-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: background var(--transition-fast), border-color var(--transition-fast);
  min-height: 28px;
}
.slot-row:hover {
  background: var(--bg-hover);
  border-left-color: var(--node-color);
}
.slot-row.renaming {
  background: color-mix(in srgb, var(--accent-blue) 8%, transparent);
  border-left-color: var(--accent-blue);
}
.slot-name {
  flex: 1;
  font-size: 11px;
  color: var(--text-primary);
  font-weight: 500;
}
.slot-time {
  font-size: 9px;
  color: var(--text-muted);
  font-family: var(--font-mono), monospace;
}

.panel-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 3px 8px;
}

.new-slot-row {
  border-left-color: transparent;
}
.new-slot-row:hover {
  background: color-mix(in srgb, var(--accent-green) 6%, transparent);
  border-left-color: var(--accent-green);
}
.new-slot-plus {
  font-size: 14px;
  line-height: 1;
  color: var(--accent-green);
  flex-shrink: 0;
}
.new-slot-label {
  font-size: 11px;
  color: var(--accent-green);
}

.rename-input {
  flex: 1;
  background: var(--bg-input);
  border: 1px solid var(--accent-blue);
  border-radius: var(--radius-sm);
  padding: 2px 6px;
  font-size: 11px;
  color: var(--text-primary);
  font-family: var(--font-ui), sans-serif;
  outline: none;
}
</style>
