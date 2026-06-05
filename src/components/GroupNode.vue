<template>
  <div :class="['group-node', { collapsed: data.collapsed }]">
    <Handle
      v-if="data.collapsed"
      :key="`source-${handlePositions.sourcePosition}`"
      type="source"
      :position="handlePositions.sourcePosition"
      id="source"
      class="source-handle"
      :style="sourceHandleStyle"
      :connectable-end="false"
    />
    <Handle
      v-if="data.collapsed"
      :key="`target-${handlePositions.targetPosition}`"
      type="target"
      :position="handlePositions.targetPosition"
      class="target-handle collapsed-dot"
      :style="targetHandleStyle"
      :connectable-start="false"
    />
    <!-- 分组头部区域，提供名称编辑和折叠切换入口。 -->
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
      <span class="group-count">({{ data.children.length }} {{ $t('group.items') }})</span>
      <button type="button" class="group-toggle" @click.stop="toggleCollapse">
        {{ data.collapsed ? $t('group.expand') : $t('group.collapse') }}
      </button>
    </div>

    <!-- 折叠摘要区域，展示分组聚合后的输入输出。 -->
    <div v-if="data.collapsed" class="group-summary">
      <div class="summary-col">
        <div class="summary-label">{{ $t('group.inputs') }}</div>
        <div v-for="(io, i) in (data.summary_recipe?.inputs || [])" :key="'in-' + i" class="summary-item">
          <span>{{ getItemName(io.item_id) }}</span>
          <span class="summary-qty">×{{ io.quantity }}</span>
        </div>
        <div v-if="!data.summary_recipe?.inputs?.length" class="summary-empty">{{ $t('group.none') }}</div>
      </div>
      <div class="summary-col">
        <div class="summary-label">{{ $t('group.outputs') }}</div>
        <div v-for="(io, i) in (data.summary_recipe?.outputs || [])" :key="'out-' + i" class="summary-item">
          <span>{{ getItemName(io.item_id) }}</span>
          <span class="summary-qty">×{{ io.quantity }}</span>
        </div>
        <div v-if="!data.summary_recipe?.outputs?.length" class="summary-empty">{{ $t('group.none') }}</div>
      </div>
    </div>

    <!-- 底部提示区域，展示分组操作说明。 -->
    <div class="group-footer">
      <span class="hint">{{ $t('group.disbandHint') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, nextTick } from 'vue';
import { Handle } from '@vue-flow/core';
import { useI18n } from 'vue-i18n';
import { useStore } from '../store';
import { getDirectionHandlePositions } from '../layout/edge-routing';
import { getCenteredHandleStyle, getTargetBarStyle } from '../layout/handle-position';

const { t } = useI18n();

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
const handlePositions = computed(() => getDirectionHandlePositions(store.appLayoutDirection));
const sourceHandleStyle = computed(() => getCenteredHandleStyle(handlePositions.value.sourcePosition, '-6px', 16));
const targetHandleStyle = computed(() => getTargetBarStyle(handlePositions.value.targetPosition));

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
  // 编辑名称时阻止折叠切换，避免双击输入框同时触发布局状态变化。
  if (isEditingName.value) return;
  store.toggleGroupCollapse(props.id);
}

function getItemName(itemId: string): string {
  return store.nodes.find(n => n.id === itemId)?.name || t('group.unknown');
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

/* 连接端口 */
:deep(.vue-flow__handle) {
  transition: all var(--transition-fast) var(--ease-smooth);
}

:deep(.vue-flow__handle.source-handle) {
  width: 16px;
  height: 16px;
  background-color: var(--accent-link, #4488ff);
  border: var(--border-width-md, 2px) solid var(--border-default);
  top: -6px;
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

:deep(.vue-flow__handle.target-handle) {
  width: 60%;
  height: 8px;
  border-radius: 0;
  background-color: var(--accent-link, #4488ff);
  border: var(--border-width-md, 2px) solid var(--border-default);
  transform: none;
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
