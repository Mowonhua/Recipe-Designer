<template>
  <div
    class="item-node"
    :class="{ orphan: data.isOrphan, selected: selected }"
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
    <div class="node-label">{{ data.name }}</div>
    <div
      v-for="slot in data.slots"
      :key="slot.id"
      class="target-wrapper"
    >
      <Handle
        type="target"
        :position="Position.Bottom"
        :id="slot.id"
        class="target-handle"
        :style="{ left: slotLeft(slot.id) }"
        :connectable-start="false"
      />
    </div>
    <div
      v-for="slot in data.slots"
      :key="'label-' + slot.id"
      class="slot-label"
      :class="{ visible: isHovered }"
      :style="{ left: slotLeft(slot.id) }"
    >{{ slot.name }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import type { ItemNode } from '../store';

const props = defineProps<{
  id: string;
  data: ItemNode & { isOrphan?: boolean };
  selected?: boolean;
}>();

const isHovered = ref(false);

function onMouseEnter() { isHovered.value = true; }
function onMouseLeave() { isHovered.value = false; }

function slotLeft(slotId: string): string {
  const slots = props.data.slots;
  if (slots.length <= 1) return '50%';
  const idx = slots.findIndex(s => s.id === slotId);
  const margin = 15;
  const range = 100 - margin * 2;
  const step = range / (slots.length - 1);
  return `${margin + idx * step}%`;
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

.item-node.orphan {
  border-style: dashed;
  opacity: 0.5;
}

.node-label {
  font-family: var(--font-ui), sans-serif;
  font-size: 13.5px;
  font-weight: 500;
  color: #f8fafc;
  text-align: center;
  letter-spacing: 0.2px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

/* Handles */
:deep(.vue-flow__handle) {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

:deep(.vue-flow__handle.source-handle) {
  width: 10px;
  height: 10px;
  background-color: var(--node-color, #94a3b8);
  border: 2px solid var(--bg-grid);
  top: -5px;
  border-radius: var(--radius-full);
}

:deep(.vue-flow__handle.source-handle:hover) {
  transform: scale(1.3);
  box-shadow: 0 0 6px var(--node-color);
}

/* Target Handles (Slots) */
:deep(.vue-flow__handle.target-handle) {
  width: 24px;
  height: 8px;
  background-color: #0b0c10;
  border: 1px solid color-mix(in srgb, var(--node-color) 40%, #333a45);
  border-radius: var(--radius-sm);
  bottom: -4px;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.8);
}

:deep(.vue-flow__handle.target-handle:hover),
:deep(.vue-flow__handle.target-handle.connecting) {
  background-color: color-mix(in srgb, var(--node-color) 15%, #1e2128);
  border-color: var(--node-color);
  box-shadow: 0 0 8px color-mix(in srgb, var(--node-color) 50%, transparent);
}

/* Target Handle wrappers */
.target-wrapper {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0; left: 0;
  pointer-events: none;
}

:deep(.vue-flow__handle) {
  pointer-events: auto;
}

.slot-label {
  position: absolute;
  bottom: -30px;
  transform: translateX(-50%);
  font-size: 9.5px;
  color: var(--text-muted);
  white-space: nowrap;
  background: rgba(15, 17, 21, 0.85);
  backdrop-filter: blur(4px);
  padding: 1px 8px;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--node-color) 25%, var(--panel-border));
  pointer-events: none;
  font-family: var(--font-mono), monospace;
  box-shadow: 0 2px 4px rgba(0,0,0,0.5);
  letter-spacing: 0.2px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.slot-label.visible {
  opacity: 1;
}
</style>
