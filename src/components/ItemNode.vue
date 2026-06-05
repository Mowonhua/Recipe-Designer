<template>
  <div
    class="item-node"
    :class="{
      orphan: data.isOrphan,
      selected,
      'drag-target': isDragHovered || isMachineDragHovered,
    }"
    :style="{ '--node-color': data.color || '#3b82f6' }"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @dragover.prevent="onDragOverNode"
    @dragleave="onDragLeaveNode"
    @drop.prevent="onDropNode"
  >
    <Handle
      :key="`source-${handlePositions.sourcePosition}`"
      type="source"
      :position="handlePositions.sourcePosition"
      id="source"
      class="source-handle"
      :style="sourceHandleStyle"
      :connectable-end="false"
    />

    <div class="node-label">
      <img v-if="iconIsImage" :src="data.icon" class="node-icon-img" />
      <span v-else-if="data.icon" class="node-icon-text">{{ data.icon }}</span>
      <span class="node-name">{{ data.name }}</span>
    </div>

    <!-- 折叠态保留不可见目标端口，使 Vue Flow 能持续识别该节点可入线。 -->
    <template v-if="!isDragHovered && !renameSlotId">
      <Handle
        v-for="slot in data.slots"
        :key="`${slot.id}-${handlePositions.targetPosition}`"
        type="target"
        :position="handlePositions.targetPosition"
        :id="slot.id"
        class="target-handle collapsed-dot"
        :style="collapsedDotStyle"
        :connectable-start="false"
      />
      <Handle
        :key="`new-slot-${handlePositions.targetPosition}`"
        type="target"
        :position="handlePositions.targetPosition"
        id="__new_slot__"
        class="target-handle collapsed-dot"
        :style="collapsedNewDotStyle"
        :connectable-start="false"
      />
      <div v-if="data.slots.length > 0" class="target-bar" :style="targetBarStyle"></div>
    </template>

    <!-- 展开态把目标端口嵌入槽位行，使拖拽连线可以精确落到指定配方槽。 -->
    <div v-else class="slot-panel">
      <div class="panel-header">{{ $t('itemNode.dropOnSlot') }}</div>

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
          :key="`${slot.id}-slot-${handlePositions.targetPosition}`"
          type="target"
          :position="handlePositions.targetPosition"
          :id="slot.id"
          class="slot-handle"
          :style="slotHandleStyle"
          :connectable-start="false"
        />
      </div>

      <div class="panel-divider"></div>

      <div class="slot-row new-slot-row">
        <span class="new-slot-plus">+</span>
        <span class="new-slot-label">{{ $t('itemNode.newSlot') }}</span>
        <Handle
          :key="`new-slot-row-${handlePositions.targetPosition}`"
          type="target"
          :position="handlePositions.targetPosition"
          id="__new_slot__"
          class="slot-handle new-slot-handle"
          :style="slotHandleStyle"
          :connectable-start="false"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject, nextTick, type Ref } from 'vue';
import { Handle } from '@vue-flow/core';
import { useI18n } from 'vue-i18n';
import type { ItemNode } from '../store';
import { useStore } from '../store';
import { getDirectionHandlePositions } from '../layout/edge-routing';
import { getCenteredHandleStyle, getSlotHandleStyle, getTargetBarStyle } from '../layout/handle-position';

const { t } = useI18n();

const props = defineProps<{
  id: string;
  data: ItemNode & { isOrphan?: boolean };
  selected?: boolean;
}>();

const store = useStore();

const isHovered = ref(false);
const isConnecting = inject<Ref<boolean>>('isConnecting', ref(false));
const isDragHovered = ref(false);
const isMachineDragHovered = ref(false);
const iconIsImage = computed(() => props.data.icon?.startsWith('data:image/') ?? false);
const handlePositions = computed(() => getDirectionHandlePositions(store.appLayoutDirection));
const sourceHandleStyle = computed(() => getCenteredHandleStyle(handlePositions.value.sourcePosition, '-8px', 16));
const collapsedDotStyle = computed(() => getCenteredHandleStyle(handlePositions.value.targetPosition, '-4px', 8));
const collapsedNewDotStyle = computed(() => getCenteredHandleStyle(handlePositions.value.targetPosition, '-4px', 8));
const slotHandleStyle = computed(() => getSlotHandleStyle(handlePositions.value.targetPosition));
const targetBarStyle = computed(() => getTargetBarStyle(handlePositions.value.targetPosition));

// 新建配方槽位进入行内重命名状态，直到用户确认或失焦后写回 store。
const renameSlotId = ref<string | null>(null);
const renameValue = ref('');

function onDragOverNode(event: DragEvent) {
  const types = event.dataTransfer?.types;
  if (types && (Array.from(types).includes('text/plain') || Array.from(types).includes('text/uri-list'))) {
    isMachineDragHovered.value = true;
  }
}

function onDragLeaveNode(event: DragEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  if (
    event.clientX <= rect.left ||
    event.clientX >= rect.right ||
    event.clientY <= rect.top ||
    event.clientY >= rect.bottom
  ) {
    isMachineDragHovered.value = false;
  }
}

function onDropNode(event: DragEvent) {
  isMachineDragHovered.value = false;
  const raw = event.dataTransfer?.getData('text/plain');
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (data.type === 'dictionary-machine') {
      store.setNodeMachine(props.data.id, data.machineId);
      event.stopPropagation();
    }
  } catch (e) {
    // 拖拽数据不是可识别的机器载荷时忽略，避免外部拖拽内容打断节点操作。
  }
}

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

// 监听由“+ New Slot”端口创建的哨兵槽位，并把它立即切换到行内重命名流程。
watch(() => props.data.slots.map(s => s.name), (names) => {
  const idx = names.indexOf('__new__');
  if (idx !== -1 && renameSlotId.value !== props.data.slots[idx]?.id) {
    const slot = props.data.slots[idx];
    renameSlotId.value = slot.id;
    renameValue.value = t('itemNode.newRecipe');
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
  const name = renameValue.value.trim() || t('itemNode.newRecipe');
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

/* 节点名称区域 */
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

/* 折叠态目标提示条 */
.target-bar {
  position: absolute;
  background: var(--node-color);
  border: var(--border-width-sm) solid var(--border-default);
  transition: all var(--transition-fast);
}

/* 折叠态不可见端口 */
.collapsed-dot {
  position: absolute;
  width: 8px;
  height: 8px;
  opacity: 0;
  pointer-events: none;
}

/* 连接端口 */
:deep(.vue-flow__handle) {
  transition: all var(--transition-fast) var(--ease-smooth);
}

/* 源端口 */
:deep(.vue-flow__handle.source-handle) {
  width: 16px;
  height: 16px;
  background-color: var(--node-color);
  border: var(--border-width-md) solid var(--border-default);
  top: -8px;
  border-radius: var(--radius-sm); /* 使用方形端口以匹配 Bauhaus 风格。 */
  z-index: 3;
}
/* 源端口 hover 时保留 Vue Flow 方向类的居中位移，再叠加旋转缩放动画。 */
:deep(.vue-flow__handle.source-handle.vue-flow__handle-top:hover) {
  transform: translate(-50%, -50%) rotate(45deg) scale(1.2);
}

:deep(.vue-flow__handle.source-handle.vue-flow__handle-bottom:hover) {
  transform: translate(-50%, 50%) rotate(45deg) scale(1.2);
}

:deep(.vue-flow__handle.source-handle.vue-flow__handle-left:hover) {
  transform: translate(-50%, -50%) rotate(45deg) scale(1.2);
}

:deep(.vue-flow__handle.source-handle.vue-flow__handle-right:hover) {
  transform: translate(50%, -50%) rotate(45deg) scale(1.2);
}

/* 槽位端口 */
:deep(.vue-flow__handle.slot-handle) {
  position: absolute;
  background: transparent;
  border: none;
  box-shadow: none;
  border-radius: var(--radius-sm);
  z-index: 1;
  transform: none;
}
:deep(.vue-flow__handle.slot-handle:hover),
:deep(.vue-flow__handle.slot-handle.connecting) {
  background: var(--node-color);
  opacity: 0.1;
}

/* 槽位选择面板 */
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
