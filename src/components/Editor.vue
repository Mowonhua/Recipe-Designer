<template>
  <div class="editor">
    <DictionaryPanel />
    <div ref="canvasWrapRef" class="canvas-wrap">
      <div class="canvas-toolbar">
        <div class="file-menu-wrap">
          <button type="button" class="toolbar-btn icon-toolbar-btn" @click="toggleFileMenu" :title="$t('editor.file')">
            <FilePlus :size="14" />
          </button>
          <div v-if="fileMenuVisible" class="ol-menu file-dropdown">
            <button class="ol-menu-item" @click="newProject(); fileMenuVisible = false">
              {{ $t('editor.newFile') }}
              <span class="menu-shortcut">Ctrl+N</span>
            </button>
            <button class="ol-menu-item" @click="openProject(); fileMenuVisible = false">
              {{ $t('editor.openFile') }}
              <span class="menu-shortcut">Ctrl+O</span>
            </button>
            <button class="ol-menu-item" @click="saveProject(); fileMenuVisible = false">
              {{ $t('editor.saveFile') }}
              <span class="menu-shortcut">Ctrl+S</span>
            </button>
            <button class="ol-menu-item" @click="saveProjectAs(); fileMenuVisible = false">
              {{ $t('editor.saveAsFile') }}
              <span class="menu-shortcut">Ctrl+Shift+S</span>
            </button>
          </div>
        </div>
        <div v-if="fileMenuVisible" class="ol-overlay" @click="fileMenuVisible = false"></div>
        <button type="button" class="toolbar-btn icon-toolbar-btn" @click="showGameSettings = true" :title="$t('editor.gameSettingsTitle')">
          <Gamepad2 :size="14" />
        </button>
        <button type="button" class="toolbar-btn icon-toolbar-btn" @click="showSettings = true" :title="$t('editor.settingsTitle')">
          <Settings :size="14" />
        </button>
      </div>
      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        :node-types="nodeTypes"
        :edge-types="edgeTypes"
        :default-edge-options="defaultEdgeOptions"
        :min-zoom="0.1"
        :max-zoom="3"
        :snap-to-grid="true"
        :snap-grid="[20, 20]"
        fit-view-on-init
        @node-drag-start="onDragStart"
        @node-drag="onDrag"
        @node-drag-stop="onDragStop"
        @node-click="onNodeClick"
        @node-double-click="onNodeDoubleClick"
        @dragover="onDragOverCanvas"
        @drop="onDropOnCanvas"
        @pane-click="onPaneClick"
        @connect="onConnect"
        @nodes-change="onNodesChange"
        @edges-change="onEdgesChange"
        @connect-start="isConnecting = true"
        @connect-end="isConnecting = false"
        @node-context-menu="onNodeContextMenu"
        @edge-context-menu="onEdgeContextMenu"
        @edge-double-click="onEdgeDoubleClick"
        @pane-context-menu="onPaneContextMenu"
        @viewport-change="onViewportChange"
      >
        <Background :gap="20" pattern-color="#1a1d24" />
        <Controls position="bottom-right" />
        <MiniMap
          position="bottom-right"
          :node-class-name="getMiniMapNodeClassName"
          :node-color="getMiniMapNodeColor"
          :node-stroke-color="getMiniMapNodeStrokeColor"
          :node-stroke-width="3"
          :node-border-radius="0"
        />
        <template #node-item="nodeProps">
          <ItemNode v-bind="nodeProps" />
        </template>
        <template #node-group="nodeProps">
          <GroupNode v-bind="nodeProps" />
        </template>
      </VueFlow>
      <NodePopover
        :visible="popoverVisible"
        :node="popoverNode"
        :position="popoverPosition"
        @close="closePopover"
        @open-drawer="onPopoverOpenDrawer"
        @switch-slot="onPopoverSwitchSlot"
      />
      <NodeDrawer
        :visible="drawerVisible"
        :node="drawerNode"
        @update:visible="(v: boolean) => { if (!v) closeDrawer(); }"
      />
      <BomPanel />
      <ContextMenu
        :visible="ctxMenuVisible"
        :position="ctxMenuPosition"
        :items="ctxMenuItems"
      />
      <div
        v-if="ctxMenuVisible"
        class="ol-overlay"
        @click="closeContextMenu"
      ></div>
      <div
        v-if="edgeEditId"
        class="rd-inline-input"
        :style="{ position: 'absolute', zIndex: 100, left: edgeEditX + 'px', top: edgeEditY + 'px', transform: 'translate(-50%, -50%)' }"
      >
        <n-input-number
          ref="edgeEditInputRef"
          v-model:value="edgeEditQty"
          size="tiny"
          :min="1"
          :step="1"
          style="width: 72px"
          @wheel.prevent="(e: WheelEvent) => onNumberWheel(() => edgeEditQty, (v) => edgeEditQty = v, 1, 1, e)"
          @keydown.enter="commitEdgeEdit()"
          @keydown.escape="cancelEdgeEdit()"
          @blur="commitEdgeEdit()"
        />
      </div>
    </div>
    <SearchOverlay v-if="showSearch" @close="showSearch = false" />
    <GameSettingsPanel v-model:visible="showGameSettings" />

    <!-- Settings Modal -->
    <n-modal v-model:show="showSettings" preset="card" :title="$t('app.settings')" class="settings-modal">
      <div class="settings-form">
        <div class="form-group">
          <label>{{ $t('app.language') }}</label>
          <n-select
            v-model:value="currentLocale"
            :options="localeOptions"
            size="medium"
            @update:value="onLocaleChange"
          />
        </div>
        <div class="form-group">
          <label>{{ $t('settings.edgeStyle') }}</label>
          <n-select
            v-model:value="appEdgeStyle"
            :options="edgeStyleOptions"
            size="medium"
          />
        </div>
        <div class="settings-section">
          <div class="section-label">{{ $t('settings.shortcuts') }}</div>
          <div class="shortcut-list">
            <button
              v-for="action in shortcutActions"
              :key="action.key"
              type="button"
              class="shortcut-row"
              :class="{ capturing: activeShortcut === action.key }"
              @click="activeShortcut = action.key"
            >
              <span>{{ action.label }}</span>
              <kbd>{{ activeShortcut === action.key ? $t('settings.pressShortcut') : shortcuts[action.key] }}</kbd>
            </button>
          </div>
          <button type="button" class="reset-shortcuts-btn" @click="resetShortcuts">
            {{ $t('settings.resetShortcuts') }}
          </button>
        </div>
      </div>
    </n-modal>
    <TemplateMappingDialog
      v-model:visible="tplMappingVisible"
      :template="tplMappingTemplate"
      :drop-position="tplMappingPosition"
    />
    <PromptDialog
      :visible="tplNamePromptVisible"
      :title="$t('template.saveAsTemplateTitle')"
      :placeholder="$t('template.templateNamePlaceholder')"
      :confirm-text="$t('dialog.ok')"
      :cancel-text="$t('dialog.cancel')"
      @confirm="onTemplateNameConfirm"
      @cancel="tplNamePromptVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, provide, watch, onMounted, onUnmounted, markRaw, computed, nextTick } from 'vue';
import { onNumberWheel } from '../composables/useWheelNumber';
import { useDrawerBodyClass } from '../composables/useDrawerBodyClass';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import type { Connection, NodeChange, EdgeChange, EdgeMouseEvent, EdgeTypesObject, NodeTypesObject } from '@vue-flow/core';
import type { FlowEdge, LayoutDirection, RecipeSlot } from '../store';
import { useStore } from '../store';
import { useI18n } from 'vue-i18n';
import { mockNodes, mockEdges, mockMachines, mockGlobalEffects, mockProliferators } from '../data/mock-data';
import { resolveRectangularCollisions, resolveZoomAwareVerticalGap } from '../layout/collision';
import { calculateSugiyamaLayout } from '../layout/sugiyama';
import { collectSelectionHighlight, type SelectionHighlight } from '../graph/selection-highlight';
import ItemNode from './ItemNode.vue';
import RecipeEdge from './RecipeEdge.vue';
import NodePopover from './NodePopover.vue';
import NodeDrawer from './NodeDrawer.vue';
import GroupNode from './GroupNode.vue';
import DictionaryPanel from './DictionaryPanel.vue';
import SearchOverlay from './SearchOverlay.vue';
import BomPanel from './BomPanel.vue';
import ContextMenu from './ContextMenu.vue';
import GameSettingsPanel from './GameSettingsPanel.vue';
import TemplateMappingDialog from './TemplateMappingDialog.vue';
import PromptDialog from './PromptDialog.vue';
import type { Template } from '../store';
import type { ContextMenuItem } from './ContextMenu.vue';
import { useBomStore } from '../store/bom-store';
import { Gamepad2, Settings, FilePlus } from 'lucide-vue-next';
import { NModal, NSelect, NInputNumber, useMessage } from 'naive-ui';
import { supportedLocales, setLocale } from '../locales';
import { initFileService, newProject, openProject, saveProject, saveProjectAs, EXTERNAL_CHANGE_EVENT, FILE_EVENT, reloadCurrentFile } from '../services/file-service';

const { t } = useI18n();
const store = useStore();
const bomStore = useBomStore();
const message = useMessage();

const appEdgeStyle = computed({
  get: () => store.appEdgeStyle,
  set: (val) => { store.appEdgeStyle = val as import('../store').EdgeStyle; },
});

const edgeStyleOptions = computed(() =>
  store.EDGE_STYLES.map(s => ({
    label: t(`settings.edgeStyle_${s}`),
    value: s,
  }))
);

const { setCenter, viewport, fitView, updateNodeInternals } = useVueFlow();

// Vue Flow 的注册表类型按通用 NodeProps/EdgeProps 建模；本地 SFC 使用更窄的业务 props，
// 因此只在注册表边界做 unknown 转换，运行时仍交由 Vue Flow 传入标准节点和边属性。
const nodeTypes = { item: markRaw(ItemNode), group: markRaw(GroupNode) } as unknown as NodeTypesObject;
const edgeTypes = { recipe: markRaw(RecipeEdge) } as unknown as EdgeTypesObject;

const defaultEdgeOptions = {
  type: 'recipe',
  animated: true,
  style: { stroke: 'var(--text-dimmed)', strokeWidth: 2, opacity: 0.8 },
};

// 向 ItemNode 注入当前连线状态，使节点能在拖拽连线期间切换悬停反馈。
const isConnecting = ref(false);
provide('isConnecting', isConnecting);

// 本地维护 Vue Flow 渲染用节点和边，store 仍是业务数据的唯一来源。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodes = ref<any[]>([]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const edges = ref<any[]>([]);

type SelectionRenderState = 'highlight' | 'dimmed' | undefined;

// 当前选中的 Vue Flow 节点只作为画布交互状态保存，业务 store 不持久化这类临时显示信息。
const selectedNodeId = ref<string | null>(null);
const selectionHighlight = ref<SelectionHighlight>(createEmptySelectionHighlight());

function createEmptySelectionHighlight(): SelectionHighlight {
  return {
    nodeIds: new Set<string>(),
    edgeIds: new Set<string>(),
  };
}

function hasSelectionHighlight(): boolean {
  return selectionHighlight.value.nodeIds.size > 0 || selectionHighlight.value.edgeIds.size > 0;
}

// 该函数根据当前选中节点和画布可见边重建高亮集合；折叠分组的边已在 syncFromStore 中重定向，所以这里直接读取 Vue Flow 边端点。
function refreshSelectionHighlight() {
  if (selectedNodeId.value && !nodes.value.some(node => node.id === selectedNodeId.value)) {
    selectedNodeId.value = null;
  }

  selectionHighlight.value = collectSelectionHighlight(selectedNodeId.value, edges.value);
  applyElementHighlightClasses();
}

function getNodeSelectionState(nodeId: string): SelectionRenderState {
  if (!hasSelectionHighlight()) return undefined;
  return selectionHighlight.value.nodeIds.has(nodeId) ? 'highlight' : 'dimmed';
}

function getEdgeSelectionState(edgeId: string): SelectionRenderState {
  if (!hasSelectionHighlight()) return undefined;
  return selectionHighlight.value.edgeIds.has(edgeId) ? 'highlight' : 'dimmed';
}

// 该函数合并 BOM 悬停高亮和节点选中高亮，保证不同交互来源只通过 class 影响 Vue Flow 派生视图。
function buildNodeClassName(nodeId: string): string | undefined {
  const classNames: string[] = [];
  const bomHighlightedId = bomStore.highlightedNodeId;
  const selectionState = getNodeSelectionState(nodeId);

  if (bomHighlightedId) {
    classNames.push(nodeId === bomHighlightedId ? 'bom-highlight' : 'bom-dimmed');
  }

  if (selectionState) {
    classNames.push(`selection-${selectionState}`);
    if (nodeId === selectedNodeId.value) {
      classNames.push('selection-focus');
    }
  }

  return classNames.length > 0 ? classNames.join(' ') : undefined;
}

function buildEdgeClassName(edgeId: string): string | undefined {
  const selectionState = getEdgeSelectionState(edgeId);
  return selectionState ? `selection-edge-${selectionState}` : undefined;
}

// 该函数按边类型生成基础样式，再叠加选中高亮或降噪状态；输入不修改业务边，只返回 Vue Flow 渲染 style。
function buildVisibleEdgeStyle(edgeType: FlowEdge['edge_type'], selectionState?: SelectionRenderState) {
  const baseStyle = edgeType === 'byproduct'
    ? { stroke: 'var(--accent-tan)', strokeWidth: 1.5, opacity: 0.7, strokeDasharray: '5,5' }
    : edgeType === 'catalyst'
      ? { stroke: 'var(--accent-blue)', strokeWidth: 2, opacity: 0.8 }
      : { stroke: 'var(--text-dimmed)', strokeWidth: 2, opacity: 0.8 };

  if (selectionState === 'highlight') {
    return {
      ...baseStyle,
      stroke: edgeType === 'input' ? 'var(--accent-amber)' : baseStyle.stroke,
      strokeWidth: Math.max(Number(baseStyle.strokeWidth), 3),
      opacity: 1,
    };
  }

  if (selectionState === 'dimmed') {
    return {
      ...baseStyle,
      opacity: 0.18,
    };
  }

  return baseStyle;
}

// 该函数把派生高亮状态写入 Vue Flow 节点和边对象，使主画布、边标签和小地图共享同一套显示状态。
function applyElementHighlightClasses() {
  for (const node of nodes.value) {
    node.class = buildNodeClassName(node.id);
  }

  for (const edge of edges.value) {
    const selectionState = getEdgeSelectionState(edge.id);
    edge.class = buildEdgeClassName(edge.id);
    edge.style = buildVisibleEdgeStyle(edge.data?.edgeType ?? 'input', selectionState);
    edge.zIndex = selectionState === 'highlight' ? 20 : 0;
    edge.data = {
      ...edge.data,
      selectionState,
    };
  }
}

// 该回调供 MiniMap 读取当前节点的高亮 class，小地图节点与主画布节点保持同一套选中关系。
function getMiniMapNodeClassName(node: { id: string }): string {
  return buildNodeClassName(node.id) || '';
}

// 该回调为小地图节点提供填充色；非关联节点在选中态下降噪，关联节点保留业务颜色。
function getMiniMapNodeColor(node: { id: string; data?: { color?: string } }): string {
  const selectionState = getNodeSelectionState(node.id);
  if (selectionState === 'dimmed') return 'var(--text-disabled)';
  return node.data?.color || 'var(--bg-surface)';
}

// 该回调为小地图节点提供描边色；选中节点用红色，其一跳关联节点用黄色，其余节点使用默认边框色。
function getMiniMapNodeStrokeColor(node: { id: string }): string {
  const selectionState = getNodeSelectionState(node.id);
  if (node.id === selectedNodeId.value) return 'var(--accent-red)';
  if (selectionState === 'highlight') return 'var(--accent-amber)';
  return 'var(--border-default)';
}

// 该函数检测节点是否没有任何输入输出边，用于在画布上标记孤立节点。
function isOrphan(nodeId: string): boolean {
  const hasIncoming = store.edges.some(e => e.target === nodeId);
  const hasOutgoing = store.edges.some(e => e.source === nodeId);
  return !hasIncoming && !hasOutgoing;
}

// 该函数从 store 生成 Vue Flow 可渲染对象，并在初次进入画布时执行自动布局。
function applyLayout() {
  // 初始化布局不写入 undo 历史，避免加载示例数据后用户第一次撤销就回到导入前的自动排列状态。
  applySugiyamaLayout(store.appLayoutDirection, false);
}

function relayout(direction?: LayoutDirection) {
  const dir = direction || store.appLayoutDirection;
  const shouldFitView = direction !== undefined;

  // 右键重布局方向同时也是当前画布显示方向；先写入 store，使端口方向和连线路由随重布局模式同步切换。
  if (store.appLayoutDirection !== dir) {
    store.appLayoutDirection = dir;
  }

  const moved = applySugiyamaLayout(dir, true);

  syncFromStore();

  if (moved || shouldFitView) {
    // 重布局后等待 Vue Flow 应用节点坐标，再执行视口适配以展示完整 DAG。
    setTimeout(() => {
      fitView({ duration: 400 });
    }, 50);
  }
}

function applySugiyamaLayout(direction: LayoutDirection, recordHistory: boolean): boolean {
  if (store.nodes.length === 0) return false;

  const nextPositions = calculateSugiyamaLayout({
    direction,
    nodes: store.nodes,
    edges: store.edges,
  });

  const moves: Array<{ id: string; type?: 'node' | 'group'; from: { x: number; y: number }; to: { x: number; y: number } }> = [];

  for (const node of store.nodes) {
    const nextPosition = nextPositions.get(node.id);
    if (!nextPosition) continue;

    const from = { ...node.position };
    const to = { x: nextPosition.x, y: nextPosition.y };

    if (from.x !== to.x || from.y !== to.y) {
      moves.push({ id: node.id, type: 'node', from, to });
    }
  }

  if (moves.length === 0) return false;

  if (recordHistory) {
    // 用户主动重布局时通过 store command 记录位置变化，使整体排列可以被 undo/redo。
    store.moveNodes(moves);
  } else {
    // 初始化布局属于派生展示状态，直接更新节点坐标以避免污染命令历史。
    const nodeById = new Map(store.nodes.map(node => [node.id, node]));
    for (const move of moves) {
      const node = nodeById.get(move.id);
      if (node) node.position = { ...move.to };
    }
  }

  return true;
}

function syncFromStore() {
  const storeNodeIds = new Set(store.nodes.map(n => n.id));

  // Remove deleted nodes
  nodes.value = nodes.value.filter(n => storeNodeIds.has(n.id));

  // Update existing + add new nodes
  for (const sn of store.nodes) {
    const existing = nodes.value.find(n => n.id === sn.id);
    const orphan = isOrphan(sn.id);
    if (existing) {
      existing.position = { x: sn.position.x, y: sn.position.y };
      existing.data = { ...sn, isOrphan: orphan };
    } else {
      nodes.value.push({
        id: sn.id,
        type: 'item',
        position: { x: sn.position.x, y: sn.position.y },
        data: { ...sn, isOrphan: orphan },
      });
    }
  }

  // 建立子节点到折叠分组的映射，用于把折叠分组内外的边重定向到分组节点。
  const nodeToCollapsedGroup = new Map<string, string>();
  for (const group of store.groups) {
    if (group.collapsed) {
      for (const childId of group.children) {
        nodeToCollapsedGroup.set(childId, group.id);
      }
    }
  }

  // 先收集可见边，再按显示源节点计算 lane，避免同一源节点的多条输出边在出口段和标签上重合。
  const visibleEdgeRows: Array<{
    edge: FlowEdge;
    displaySource: string;
    displayTarget: string;
    sourceHandle?: string;
    targetHandle?: string;
    laneKey: string;
  }> = [];

  for (const se of store.edges) {
    const sourceGroup = nodeToCollapsedGroup.get(se.source);
    const targetGroup = nodeToCollapsedGroup.get(se.target);

    // 折叠分组内部的边由分组摘要表达，不再单独绘制。
    if (sourceGroup && targetGroup && sourceGroup === targetGroup) {
      continue;
    }

    const displaySource = sourceGroup || se.source;
    const displayTarget = targetGroup || se.target;
    visibleEdgeRows.push({
      edge: se,
      displaySource,
      displayTarget,
      sourceHandle: sourceGroup ? undefined : 'source',
      targetHandle: targetGroup ? undefined : (se.target_slot_id || undefined),
      laneKey: `${displaySource}:${store.appEdgeStyle}`,
    });
  }

  const laneCounts = new Map<string, number>();
  for (const row of visibleEdgeRows) {
    laneCounts.set(row.laneKey, (laneCounts.get(row.laneKey) ?? 0) + 1);
  }

  const laneIndices = new Map<string, number>();
  const newEdges = visibleEdgeRows.map(row => {
    const se = row.edge;
    const laneIndex = laneIndices.get(row.laneKey) ?? 0;
    laneIndices.set(row.laneKey, laneIndex + 1);

    const edgeStyle = buildVisibleEdgeStyle(se.edge_type);
    const animated = true;

    return {
      id: se.id,
      source: row.displaySource,
      target: row.displayTarget,
      sourceHandle: row.sourceHandle,
      targetHandle: row.targetHandle,
      type: 'recipe',
      animated,
      label: `x${se.quantity}`,
      style: edgeStyle,
      data: {
        edgeStyle: store.appEdgeStyle,
        edgeType: se.edge_type,
        layoutDirection: store.appLayoutDirection,
        laneIndex,
        laneCount: laneCounts.get(row.laneKey) ?? 1,
      },
    };
  });
  edges.value = newEdges;

  // 同步分组节点本体，折叠分组会作为边的显示端点参与连接。
  const groupIds = new Set(store.groups.map(g => g.id));

  // Determine hidden children (only children of collapsed groups)
  const hiddenChildren = new Set<string>();
  for (const group of store.groups) {
    if (group.collapsed) {
      for (const childId of group.children) {
        hiddenChildren.add(childId);
      }
    }
  }

  // Clean stale nodes from canvas
  nodes.value = nodes.value.filter((n: any) => {
    if (n.type === 'item' && hiddenChildren.has(n.id)) return false;
    if (n.type === 'group' && !groupIds.has(n.id)) return false;
    return true;
  });

  // Add or update group nodes
  for (const group of store.groups) {
    if (!group.position || !group.size) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let hasChildren = false;
      for (const childId of group.children) {
        const child = store.nodes.find(n => n.id === childId);
        if (child) { 
          hasChildren = true;
          minX = Math.min(minX, child.position.x);
          minY = Math.min(minY, child.position.y);
          maxX = Math.max(maxX, child.position.x + 170);
          maxY = Math.max(maxY, child.position.y + 60);
        }
      }
      if (!hasChildren) { minX = 0; minY = 0; maxX = 200; maxY = 100; }
      const padding = 40;
      group.position = { x: minX - padding, y: minY - padding - 40 };
      group.size = { width: (maxX - minX) + padding * 2, height: (maxY - minY) + padding * 2 + 40 };
    }

    const groupPos = { ...group.position };
    const groupWidth = group.collapsed ? 240 : group.size.width;
    const groupHeight = group.collapsed ? undefined : group.size.height;

    const existing = nodes.value.find((n: any) => n.id === group.id);
    if (existing) {
      existing.position = groupPos;
      existing.data = {
        ...existing.data,
        name: group.name,
        children: group.children,
        collapsed: group.collapsed,
        summary_recipe: group.summary_recipe,
      };
      existing.style = { 
        ...existing.style, 
        width: `${groupWidth}px`,
        height: groupHeight ? `${groupHeight}px` : 'auto',
        zIndex: group.collapsed ? 5 : -1 
      };
    } else {
      nodes.value.push({
        id: group.id,
        type: 'group',
        position: groupPos,
        data: {
          name: group.name,
          children: group.children,
          collapsed: group.collapsed,
          summary_recipe: group.summary_recipe,
          isEditingName: true // Enable editing name immediately upon creation
        },
        style: { 
          width: `${groupWidth}px`, 
          height: groupHeight ? `${groupHeight}px` : 'auto',
          zIndex: group.collapsed ? 5 : -1 
        },
      });
    }
  }

  // 结构同步可能新增、删除或重定向可见边，需在最终节点/边列表稳定后重新应用选中高亮。
  refreshSelectionHighlight();
}

// Watch for structural changes
watch(
  () => [store.nodes.length, store.edges.length, store.changeCounter, store.groups.length, store.appEdgeStyle, store.appLayoutDirection],
  () => { syncFromStore(); },
  { flush: 'sync' },
);

// 布局方向会改变 Handle 的真实边缘位置；等待节点 DOM 更新后重新测量端口，避免连线仍使用旧出入点。
watch(
  () => store.appLayoutDirection,
  async () => {
    await nextTick();
    await waitForLayoutFrame();
    const ids = nodes.value.map((node: any) => node.id);
    if (ids.length > 0) {
      updateNodeInternals(ids);
      await nextTick();
      syncFromStore();
    }
  },
  { flush: 'post' },
);

// 该函数等待浏览器完成一帧布局计算，使 Vue Flow 重测端口时能读取到重建后 Handle 的最终几何信息。
function waitForLayoutFrame(): Promise<void> {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return Promise.resolve();
  }

  return new Promise(resolve => window.requestAnimationFrame(() => resolve()));
}

// BOM 悬停状态变化时只重新合成 Vue Flow class，避免覆盖当前选中节点的一跳关联高亮。
watch(
  () => bomStore.highlightedNodeId,
  () => { applyElementHighlightClasses(); },
);

// Close context menu when pane is clicked
function onPaneClick() {
  selectedNodeId.value = null;
  refreshSelectionHighlight();
  closePopover();
  closeContextMenu();
  cancelEdgeEdit();
}

// --- 拖拽位置追踪 ---
const dragStartPositions = new Map<string, { x: number; y: number }>();

const NODE_W = 170;
const NODE_H = 60;
const COLLISION_HORIZONTAL_GAP = 2;
const COLLISION_VERTICAL_GAP = 32;
const COLLISION_VERTICAL_SCREEN_GAP = 32;

function runCollision(anchoredIds: Set<string>) {
  // 只让画布上的可交互根节点参与防重叠；展开分组内部的子节点由分组边界约束，不在全局推开中移动。
  const activeNodes = nodes.value.filter((n: any) => {
    if (n.type === 'group' && !n.data.collapsed) return false;
    if (n.type === 'item') {
      const groupInfo = store.groups.find(g => g.children.includes(n.id as string) && !g.collapsed);
      if (groupInfo) return false;
    }
    return true;
  });

  // 将 Vue Flow 节点转换为矩形碰撞输入；折叠分组使用更大的可视尺寸，普通物品节点使用固定节点尺寸。
  const collisionNodes = activeNodes.map((n: any) => {
    const w = (n.type === 'group' && n.data.collapsed) ? 240 : NODE_W;
    const h = (n.type === 'group' && n.data.collapsed) ? 100 : NODE_H;
    return { id: n.id as string, x: n.position.x, y: n.position.y, width: w, height: h };
  });

  const resolvedPositions = resolveRectangularCollisions({
    nodes: collisionNodes,
    anchoredIds,
    horizontalGap: COLLISION_HORIZONTAL_GAP,
    verticalGap: resolveZoomAwareVerticalGap({
      minGraphGap: COLLISION_VERTICAL_GAP,
      minScreenGap: COLLISION_VERTICAL_SCREEN_GAP,
      zoom: viewport.value.zoom,
    }),
  });

  // 拖拽过程只更新 Vue Flow 本地节点位置；最终 store 写入统一在 onDragStop 中生成一条 undo 记录。
  for (const [id, position] of resolvedPositions) {
    if (anchoredIds.has(id)) continue;
    const vn = nodes.value.find((n: any) => n.id === id);
    if (!vn) continue;

    if (vn.position.x !== position.x || vn.position.y !== position.y) {
      vn.position = { x: position.x, y: position.y };
    }
  }
}

function syncDraggedPositions(draggedNodes: { id: string; position: { x: number; y: number } }[]) {
  // Vue Flow 的拖拽事件节点可能早于 v-model 数组完成同步；碰撞前先写入最新拖拽坐标，避免用上一帧位置计算推开距离。
  for (const draggedNode of draggedNodes) {
    const localNode = nodes.value.find((n: any) => n.id === draggedNode.id);
    if (!localNode) continue;

    if (localNode.position.x !== draggedNode.position.x || localNode.position.y !== draggedNode.position.y) {
      localNode.position = { x: draggedNode.position.x, y: draggedNode.position.y };
    }
  }
}

function onDragStart(_event: { nodes: { id: string; type: string; position: { x: number; y: number } }[] }) {
  // 记录所有画布节点的拖拽前坐标，确保被防重叠算法推开的节点也能进入同一条 undo 记录。
  for (const n of nodes.value) {
    dragStartPositions.set(n.id as string, { ...n.position });
  }
}

function onDrag(event: { nodes: { id: string; type: string; position: { x: number; y: number } }[] }) {
  for (const dn of event.nodes) {
    if (dn.type === 'group') {
      const start = dragStartPositions.get(dn.id);
      if (!start) continue;
      const dx = dn.position.x - start.x;
      const dy = dn.position.y - start.y;
      
      const group = store.groups.find(g => g.id === dn.id);
      if (group && !group.collapsed) {
        for (const childId of group.children) {
          const vn = nodes.value.find((n: any) => n.id === childId);
          const cStart = dragStartPositions.get(childId);
          if (vn && cStart && !event.nodes.some(en => en.id === childId)) {
            vn.position = { x: cStart.x + dx, y: cStart.y + dy };
          }
        }
      }
    } else if (dn.type === 'item') {
      const group = store.groups.find(g => g.children.includes(dn.id) && !g.collapsed);
      if (group && group.position && group.size) {
        const gw = group.size.width;
        const gh = group.size.height;
        const minX = group.position.x + 20;
        const minY = group.position.y + 40;
        const maxX = group.position.x + gw - 170 - 20;
        const maxY = group.position.y + gh - 60 - 20;
        dn.position.x = Math.max(minX, Math.min(maxX, dn.position.x));
        dn.position.y = Math.max(minY, Math.min(maxY, dn.position.y));
      }
    }
  }

  syncDraggedPositions(event.nodes);
  const anchoredIds = new Set(event.nodes.map(n => n.id));
  runCollision(anchoredIds);
}

function onDragStop(event: { nodes: { id: string; type: string; position: { x: number; y: number } }[] }) {
  // 拖拽结束时再执行一次最终防重叠，保证鼠标释放后的节点边界状态稳定。
  syncDraggedPositions(event.nodes);
  const anchoredIds = new Set(event.nodes.map(n => n.id));
  runCollision(anchoredIds);

  // 将拖拽节点与被推开节点的位置变化合并为一条原子 undo 记录。
  const moves: Array<{ id: string; type?: 'node' | 'group'; from: { x: number; y: number }; to: { x: number; y: number } }> = [];
  for (const vn of nodes.value) {
    const from = dragStartPositions.get(vn.id as string);
    if (from && (from.x !== vn.position.x || from.y !== vn.position.y)) {
      moves.push({ id: vn.id as string, type: vn.type === 'group' ? 'group' : 'node', from, to: { ...vn.position } });
      // 本地 Vue Flow 节点坐标已经更新，这里同步写回 store 作为后续保存与重绘的数据源。
      if (vn.type === 'group') {
        const sg = store.groups.find(g => g.id === vn.id);
        if (sg) {
          sg.position = { ...vn.position };
          // 折叠分组移动时其子节点不可见，需要手动把同样位移写回隐藏子节点。
          if (sg.collapsed) {
            const dx = vn.position.x - from.x;
            const dy = vn.position.y - from.y;
            for (const childId of sg.children) {
              const sn = store.nodes.find(n => n.id === childId);
              if (sn) {
                const childFrom = { ...sn.position };
                const childTo = { x: sn.position.x + dx, y: sn.position.y + dy };
                sn.position = childTo;
                moves.push({ id: childId, type: 'node', from: childFrom, to: childTo });
              }
            }
          }
        }
      } else {
        const sn = store.nodes.find(n => n.id === vn.id);
        if (sn) {
          sn.position.x = vn.position.x;
          sn.position.y = vn.position.y;
        }
      }
    }
  }
  dragStartPositions.clear();

  if (moves.length) {
    store.moveNodes(moves);
  }
}

// --- Connection handling ---
function onConnect(connection: Connection) {
  if (connection.source === connection.target) return;

  let targetSlotId = connection.targetHandle || '';

  // New-slot sentinel: user dropped on "+ New Slot" in the panel
  if (targetSlotId === '__new_slot__') {
    const newSlot: RecipeSlot = {
      id: uuidv4(),
      name: '__new__',
      time: 1,
      machine_id: store.machines[0]?.id || '',
      tags: [],
      primary_output_quantity: 1,
      secondary_outputs: [],
      catalyst_mode: 'none',
    };
    store.addSlot(connection.target, newSlot);
    targetSlotId = newSlot.id;
    store.setActiveSlot(connection.target, newSlot.id);
  }

  // Lazy slot creation: if target has no slots, create a default one
  if (!targetSlotId) {
    const targetNode = store.nodes.find(n => n.id === connection.target);
    if (targetNode && targetNode.slots.length === 0) {
      const newSlot: RecipeSlot = {
        id: uuidv4(),
        name: t('editor.defaultSlotName'),
        time: 1,
        machine_id: store.machines[0]?.id || '',
        tags: [],
        primary_output_quantity: 1,
        secondary_outputs: [],
        catalyst_mode: 'none',
      };
      store.addSlot(connection.target, newSlot);
      targetSlotId = newSlot.id;
      store.setActiveSlot(connection.target, newSlot.id);
    }
  }

  if (!targetSlotId) return;

  const newEdge: FlowEdge = {
    id: uuidv4(),
    source: connection.source,
    target: connection.target,
    target_slot_id: targetSlotId,
    quantity: 1,
    edge_type: 'input',
  };
  store.addEdge(newEdge);
}

// --- Batched removal handling ---
const pendingRemovals: Array<{ type: 'node' | 'edge'; id: string }> = [];
let removalTimer: ReturnType<typeof setTimeout> | null = null;

function flushRemovals() {
  const nodeIds = pendingRemovals.filter(r => r.type === 'node').map(r => r.id);
  const edgeIds = pendingRemovals.filter(r => r.type === 'edge').map(r => r.id);
  pendingRemovals.length = 0;
  removalTimer = null;

  if (nodeIds.length > 0) {
    // DeleteNodesCommand handles both nodes and their connected edges
    store.deleteNodes(nodeIds);
  } else {
    // Only standalone edge deletions
    for (const eid of edgeIds) {
      if (store.edges.some(e => e.id === eid)) {
        store.deleteEdge(eid);
      }
    }
  }
}

function syncSelectedNodeFromCanvas() {
  // Vue Flow 可能在同一批 changes 后才写回 selected 字段；等待 DOM/响应式队列后读取最终选中节点。
  const selectedNode = [...nodes.value].reverse().find(node => node.selected);
  selectedNodeId.value = selectedNode?.id ?? null;
  refreshSelectionHighlight();
}

function onNodesChange(changes: NodeChange[]) {
  let selectionChanged = false;

  for (const c of changes) {
    if (c.type === 'remove') {
      pendingRemovals.push({ type: 'node', id: c.id });
    } else if (c.type === 'select') {
      selectionChanged = true;
    }
  }

  if (selectionChanged) {
    nextTick(() => { syncSelectedNodeFromCanvas(); });
  }

  if (!removalTimer) removalTimer = setTimeout(flushRemovals, 0);
}

function onEdgesChange(changes: EdgeChange[]) {
  for (const c of changes) {
    if (c.type === 'remove') {
      pendingRemovals.push({ type: 'edge', id: c.id });
    }
  }
  if (!removalTimer) removalTimer = setTimeout(flushRemovals, 0);
}

// --- Edge inline label editing ---
const edgeEditId = ref<string | null>(null);
const edgeEditQty = ref(1);
const edgeEditX = ref(0);
const edgeEditY = ref(0);
const edgeEditInputRef = ref<InstanceType<typeof NInputNumber> | null>(null);

function onEdgeDoubleClick(event: EdgeMouseEvent) {
  const edgeId = event.edge.id as string;
  const storeEdge = store.edges.find(e => e.id === edgeId);
  if (!storeEdge) return;
  edgeEditId.value = edgeId;
  edgeEditQty.value = storeEdge.quantity;
  const rect = canvasWrapRef.value?.getBoundingClientRect();
  const me = event.event as MouseEvent;
  if (rect && me.clientX !== undefined) {
    edgeEditX.value = me.clientX - rect.left;
    edgeEditY.value = me.clientY - rect.top;
  }
  nextTick(() => {
    const input = edgeEditInputRef.value?.$el?.querySelector('input') as HTMLInputElement | null;
    input?.focus();
    input?.select();
  });
}

function commitEdgeEdit() {
  if (!edgeEditId.value) return;
  const qty = Math.round(edgeEditQty.value);
  if (qty > 0 && Number.isFinite(qty)) {
    store.updateEdge(edgeEditId.value, { quantity: qty });
  }
  edgeEditId.value = null;
}


function cancelEdgeEdit() {
  edgeEditId.value = null;
}

// --- Viewport ---
function onViewportChange(viewport: { zoom: number; x: number; y: number }) {
  store.meta.viewport = { zoom: viewport.zoom, center: { x: viewport.x, y: viewport.y } };
}

// --- Search fly-to handler ---
function onSearchFlyTo(e: Event) {
  const detail = (e as CustomEvent).detail as { x: number; y: number };
  setCenter(detail.x, detail.y, { zoom: 1.0, duration: 400 });
}

// --- Search overlay ---
const showSearch = ref(false);

// --- Settings ---
const showSettings = ref(false);
const showGameSettings = ref(false);
const fileMenuVisible = ref(false);

function toggleFileMenu() {
  fileMenuVisible.value = !fileMenuVisible.value;
}

const tplMappingVisible = ref(false);
const tplMappingTemplate = ref<Template | null>(null);
const tplMappingPosition = ref({ x: 0, y: 0 });
const tplNamePromptVisible = ref(false);
const tplSelectedIds: string[] = [];
const currentLocale = ref(localStorage.getItem('app-locale') || 'en-US');
const localeOptions = supportedLocales.map(l => ({ label: l.label, value: l.value }));

type ShortcutAction = 'undo' | 'redo' | 'search' | 'bom' | 'relayout' | 'createGroup' | 'disbandGroup';
type ShortcutMap = Record<ShortcutAction, string>;

const defaultShortcuts: ShortcutMap = {
  undo: 'Ctrl+Z',
  redo: 'Ctrl+Y',
  search: 'Ctrl+P',
  bom: 'Ctrl+B',
  relayout: 'Ctrl+R',
  createGroup: 'Ctrl+G',
  disbandGroup: 'Ctrl+Shift+G',
};

function loadShortcuts(): ShortcutMap {
  try {
    const raw = localStorage.getItem('rd-shortcuts');
    return raw ? { ...defaultShortcuts, ...JSON.parse(raw) } : { ...defaultShortcuts };
  } catch {
    return { ...defaultShortcuts };
  }
}

const shortcuts = ref<ShortcutMap>(loadShortcuts());
const activeShortcut = ref<ShortcutAction | null>(null);

const shortcutActions = computed(() => [
  { key: 'undo' as const, label: t('settings.undo') },
  { key: 'redo' as const, label: t('settings.redo') },
  { key: 'search' as const, label: t('settings.search') },
  { key: 'bom' as const, label: t('settings.bom') },
  { key: 'relayout' as const, label: t('settings.relayout') },
  { key: 'createGroup' as const, label: t('settings.createGroup') },
  { key: 'disbandGroup' as const, label: t('settings.disbandGroup') },
]);

function persistShortcuts() {
  localStorage.setItem('rd-shortcuts', JSON.stringify(shortcuts.value));
}

function resetShortcuts() {
  shortcuts.value = { ...defaultShortcuts };
  persistShortcuts();
}

function shortcutFor(action: ShortcutAction): string {
  return shortcuts.value[action];
}

function formatShortcutFromEvent(e: KeyboardEvent): string | null {
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  parts.push(key);
  return parts.join('+');
}

function matchesShortcut(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.split('+');
  const key = parts[parts.length - 1]?.toLowerCase();
  const wantsCtrl = parts.includes('Ctrl');
  const wantsShift = parts.includes('Shift');
  const wantsAlt = parts.includes('Alt');
  return (e.ctrlKey || e.metaKey) === wantsCtrl
    && e.shiftKey === wantsShift
    && e.altKey === wantsAlt
    && e.key.toLowerCase() === key;
}

function onLocaleChange(newLocale: string) {
  setLocale(newLocale);
  currentLocale.value = newLocale;
}

// --- Popover state ---
const popoverVisible = ref(false);
const popoverNodeId = ref<string | null>(null);
const popoverNode = computed(() => {
  if (!popoverNodeId.value) return null;
  return store.nodes.find(n => n.id === popoverNodeId.value) || null;
});
const canvasWrapRef = ref<HTMLDivElement | null>(null);

const popoverPosition = computed(() => {
  const node = popoverNode.value;
  if (!node || !canvasWrapRef.value) return { x: 0, y: 0 };
  // Read live position from Vue Flow nodes so popover follows during drag
  const vfNode = nodes.value.find((n: any) => n.id === node.id);
  const pos = vfNode ? vfNode.position : node.position;
  const rect = canvasWrapRef.value.getBoundingClientRect();
  const vp = viewport.value;
  const cx = pos.x + 80; // center-top of node
  const cy = pos.y;
  return {
    x: rect.left + cx * vp.zoom + vp.x,
    y: rect.top + cy * vp.zoom + vp.y,
  };
});

function onNodeClick(event: any) {
  // 节点点击立即更新高亮来源，避免等待 Vue Flow selection change 时出现一帧延迟。
  selectedNodeId.value = event.node.id as string;
  refreshSelectionHighlight();

  const nodeData = event.node.data;
  if (!nodeData || !nodeData.id) return;
  popoverNodeId.value = nodeData.id;
  popoverVisible.value = true;
}

function closePopover() {
  popoverVisible.value = false;
  popoverNodeId.value = null;
}

function onPopoverSwitchSlot(slotId: string) {
  if (!popoverNode.value) return;
  store.setActiveSlot(popoverNode.value.id, slotId);
}

function onPopoverOpenDrawer() {
  const nodeId = popoverNode.value?.id;
  popoverVisible.value = false;
  if (nodeId) {
    drawerNode.value = store.nodes.find(n => n.id === nodeId) || null;
    drawerVisible.value = true;
  }
}

// --- Context menu state ---
const ctxMenuVisible = ref(false);
const ctxMenuPosition = ref({ x: 0, y: 0 });
const ctxMenuTargetType = ref<'node' | 'edge' | 'pane' | null>(null);
const ctxMenuNodeId = ref<string | null>(null);
const ctxMenuEdgeId = ref<string | null>(null);

const ctxMenuItems = computed<ContextMenuItem[]>(() => {
  if (ctxMenuTargetType.value === 'node' && ctxMenuNodeId.value) {
    const nodeId = ctxMenuNodeId.value;
    const node = store.nodes.find(n => n.id === nodeId);
    if (!node) return [];
    const activeSlotId = node.active_slot_id || node.slots[0]?.id;
    return [
      {
        key: 'bom',
        label: t('editor.calculateBom'),
        shortcut: shortcutFor('bom'),
        disabled: !activeSlotId,
        action: () => {
          if (activeSlotId) {
            openBomPanelForNode(node.id, activeSlotId);
          }
          closeContextMenu();
        },
      },
      {
        key: 'disconnect-all',
        label: t('editor.disconnectAllEdges'),
        action: () => {
          const edgeIds = store.edges
            .filter(e => e.source === nodeId || e.target === nodeId)
            .map(e => e.id);
          for (const eid of edgeIds) store.deleteEdge(eid);
          closeContextMenu();
        },
      },
      {
        key: 'disconnect-outgoing',
        label: t('editor.disconnectOutgoingEdges'),
        action: () => {
          const edgeIds = store.edges
            .filter(e => e.source === nodeId)
            .map(e => e.id);
          for (const eid of edgeIds) store.deleteEdge(eid);
          closeContextMenu();
        },
      },
      {
        key: 'disconnect-incoming',
        label: t('editor.disconnectIncomingEdges'),
        action: () => {
          const edgeIds = store.edges
            .filter(e => e.target === nodeId)
            .map(e => e.id);
          for (const eid of edgeIds) store.deleteEdge(eid);
          closeContextMenu();
        },
      },
      {
        key: 'delete-node',
        label: t('editor.deleteNode'),
        action: () => {
          store.deleteNodes([nodeId]);
          closeContextMenu();
        },
      },
    ];
  }

  if (ctxMenuTargetType.value === 'edge' && ctxMenuEdgeId.value) {
    return [
      {
        key: 'disconnect-edge',
        label: t('editor.disconnectEdge'),
        action: () => {
          store.deleteEdge(ctxMenuEdgeId.value!);
          closeContextMenu();
        },
      },
    ];
  }

  if (ctxMenuTargetType.value === 'pane') {
    return [
      {
        key: 'relayout-bt',
        label: t('editor.relayoutBT'),
        shortcut: shortcutFor('relayout'),
        action: () => {
          relayout('BT');
          closeContextMenu();
        },
      },
      {
        key: 'relayout-tb',
        label: t('editor.relayoutTB'),
        action: () => {
          relayout('TB');
          closeContextMenu();
        },
      },
      {
        key: 'relayout-lr',
        label: t('editor.relayoutLR'),
        action: () => {
          relayout('LR');
          closeContextMenu();
        },
      },
      {
        key: 'clean-orphans',
        label: t('editor.cleanOrphans'),
        action: () => {
          store.deleteOrphans();
          closeContextMenu();
        },
      },
    ];
  }

  return [];
});

function onNodeContextMenu(event: any) {
  event.event.preventDefault();
  const nodeData = event.node.data;
  if (!nodeData || !nodeData.id) return;
  ctxMenuTargetType.value = 'node';
  ctxMenuNodeId.value = nodeData.id;
  ctxMenuEdgeId.value = null;
  ctxMenuPosition.value = { x: event.event.clientX, y: event.event.clientY };
  ctxMenuVisible.value = true;
}

function onEdgeContextMenu(event: EdgeMouseEvent) {
  event.event.preventDefault();
  const edgeId = event.edge.id as string;
  if (!edgeId) return;
  const me = event.event as MouseEvent;
  ctxMenuTargetType.value = 'edge';
  ctxMenuEdgeId.value = edgeId;
  ctxMenuNodeId.value = null;
  ctxMenuPosition.value = { x: me.clientX, y: me.clientY };
  ctxMenuVisible.value = true;
}

function onPaneContextMenu(event: MouseEvent | { event: MouseEvent }) {
  const mouseEvent = event instanceof MouseEvent ? event : event.event;
  mouseEvent.preventDefault();
  ctxMenuTargetType.value = 'pane';
  ctxMenuNodeId.value = null;
  ctxMenuEdgeId.value = null;
  ctxMenuPosition.value = { x: mouseEvent.clientX, y: mouseEvent.clientY };
  ctxMenuVisible.value = true;
}

function closeContextMenu() {
  ctxMenuVisible.value = false;
  ctxMenuTargetType.value = null;
  ctxMenuNodeId.value = null;
  ctxMenuEdgeId.value = null;
}

// --- BOM panel ---
function openBomPanel() {
  const node = popoverNode.value || drawerNode.value;
  if (!node) return;
  const slotId = node.active_slot_id || node.slots[0]?.id;
  openBomPanelForNode(node.id, slotId);
}

function openBomPanelForNode(nodeId: string, slotId: string | undefined) {
  bomStore.calculateFromNode(nodeId, slotId);
}

// --- Drawer state ---
const drawerVisible = ref(false);
const drawerNode = ref<any>(null);

useDrawerBodyClass(drawerVisible, 420);

watch(() => bomStore.panelVisible, (val) => {
  if (val) {
    document.body.classList.add('bom-panel-open');
  } else {
    document.body.classList.remove('bom-panel-open');
  }
});

function onNodeDoubleClick(event: any) {
  const nodeData = event.node.data;
  if (!nodeData || !nodeData.id) return;
  if (event.node.type === 'group') return;  // groups don't have drawers
  drawerNode.value = store.nodes.find(n => n.id === nodeData.id) || null;
  drawerVisible.value = true;
  popoverVisible.value = false;
}

function closeDrawer() {
  drawerVisible.value = false;
  drawerNode.value = null;
}

// --- Canvas drop ---
function onDragOverCanvas(event: DragEvent) {
  const types = event.dataTransfer?.types;
  if (types && (Array.from(types).includes('text/plain') || Array.from(types).includes('text/uri-list'))) {
    event.preventDefault();
  }
}

function onDropOnCanvas(event: DragEvent) {
  const raw = event.dataTransfer?.getData('text/plain');
  if (!raw) return;
  const canvasEl = document.querySelector('.canvas-wrap');
  const rect = canvasEl?.getBoundingClientRect();
  if (!rect) return;
  try {
    const data = JSON.parse(raw);

    if (data.type === 'dictionary-item') {
      const nodeId = data.nodeId;
      if (!store.isNodeOnCanvas(nodeId)) {
        const vp = viewport.value;
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;
        const x = (canvasX - vp.x) / vp.zoom - 80; // center node under cursor (node half-width)
        const y = (canvasY - vp.y) / vp.zoom - 24; // center node under cursor (node half-height)
        store.placeNodeOnCanvas(nodeId, { x, y });
        syncFromStore();
      } else {
        const node = store.nodes.find(n => n.id === nodeId);
        if (node) {
          window.dispatchEvent(new CustomEvent('search-fly-to', {
            detail: { x: node.position.x, y: node.position.y },
          }));
        }
      }
    } else if (data.type === 'dictionary-machine') {
      const machineId = data.machineId;
      // Find node under the drop position
      const targetNode = findNodeAtDrop(event.clientX - rect.left, event.clientY - rect.top);
      if (targetNode) {
        store.setNodeMachine(targetNode.id, machineId);
      }
    } else if (data.type === 'dictionary-template') {
      const templateId = data.templateId;
      const tpl = store.getTemplates().find(t => t.id === templateId);
      if (tpl) {
        const vp = viewport.value;
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;
        tplMappingTemplate.value = tpl;
        tplMappingPosition.value = {
          x: (canvasX - vp.x) / vp.zoom,
          y: (canvasY - vp.y) / vp.zoom,
        };
        tplMappingVisible.value = true;
      }
    }
  } catch { /* ignore */ }
}

function findNodeAtDrop(canvasX: number, canvasY: number): { id: string } | null {
  const vp = viewport.value;
  const flowX = (canvasX - vp.x) / vp.zoom;
  const flowY = (canvasY - vp.y) / vp.zoom;
  for (const vfNode of nodes.value) {
    if ((vfNode as any).type !== 'item') continue;
    const dim = (vfNode as any).dimensions;
    if (!dim || !dim.width || !dim.height) continue;
    const nx = (vfNode as any).position.x;
    const ny = (vfNode as any).position.y;
    if (flowX >= nx && flowX <= nx + dim.width && flowY >= ny && flowY <= ny + dim.height) {
      return { id: vfNode.id };
    }
  }
  return null;
}

// --- Group helpers ---
function createGroupFromSelection() {
  const selectedIds = nodes.value
    .filter((n: any) => n.selected && n.type === 'item')
    .map((n: any) => n.id as string);
  if (selectedIds.length < 2) return;
  store.addGroup(t('editor.newGroup'), selectedIds);
}

function disbandSelectedGroup() {
  const selectedGroups = nodes.value
    .filter((n: any) => n.selected && n.type === 'group')
    .map((n: any) => n.id as string);
  for (const gid of selectedGroups) {
    store.removeGroup(gid);
  }
}

// --- Keyboard shortcuts ---
function onKeydown(e: KeyboardEvent) {
  if (activeShortcut.value) {
    const combo = formatShortcutFromEvent(e);
    if (combo) {
      e.preventDefault();
      shortcuts.value = { ...shortcuts.value, [activeShortcut.value]: combo };
      persistShortcuts();
      activeShortcut.value = null;
    }
    return;
  }

  const target = e.target as HTMLElement | null;
  const isEditingText = target?.matches('input, textarea, [contenteditable="true"]') || target?.closest('.n-select');
  if (isEditingText) return;

  if (matchesShortcut(e, shortcutFor('createGroup'))) {
    e.preventDefault();
    createGroupFromSelection();
    return;
  }
  if (matchesShortcut(e, shortcutFor('disbandGroup'))) {
    e.preventDefault();
    disbandSelectedGroup();
    return;
  }

  if (matchesShortcut(e, shortcutFor('undo'))) {
    e.preventDefault();
    store.undo();
  } else if (matchesShortcut(e, shortcutFor('redo'))) {
    e.preventDefault();
    store.redo();
  } else if (matchesShortcut(e, shortcutFor('bom'))) {
    e.preventDefault();
    openBomPanel();
  } else if (matchesShortcut(e, shortcutFor('search'))) {
    e.preventDefault();
    showSearch.value = !showSearch.value;
  } else if (matchesShortcut(e, shortcutFor('relayout'))) {
    e.preventDefault();
    relayout();
  } else if (e.key === 'Escape' && showSearch.value) {
    showSearch.value = false;
  } else if (e.key === 'Escape' && activeShortcut.value) {
    activeShortcut.value = null;
  } else if (e.key === 'Escape' && fileMenuVisible.value) {
    fileMenuVisible.value = false;
  } else if (e.key === 'Escape') {
    closeContextMenu();
  }

  // File operations (standard shortcuts, not rebindable)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveProjectAs();
  } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveProject();
  } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'o') {
    e.preventDefault();
    openProject();
  } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    newProject();
  }
}

// --- Lifecycle ---
onMounted(async () => {
  // 初始化文件服务；Tauri 环境会尝试恢复上次打开的项目，浏览器环境会返回 false。
  const restoredProject = await initFileService();

  // 仅浏览器开发环境注入示例数据；Tauri 已恢复项目时保留磁盘中的节点位置，不执行自动重布局。
  const isTauri = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
  const shouldSeedMock = !isTauri && !restoredProject;
  if (shouldSeedMock) {
    store.seedData({
      nodes: mockNodes,
      edges: mockEdges,
      machines: mockMachines,
      global_effects: mockGlobalEffects,
      proliferators: mockProliferators,
    });
    applyLayout();
  }
  syncFromStore();

  // Keyboard listener on window (for shortcuts even when canvas not focused)
  window.addEventListener('keydown', onKeydown as EventListener);
  window.addEventListener('search-fly-to', onSearchFlyTo);
  window.addEventListener(EXTERNAL_CHANGE_EVENT, onExternalChange);
  window.addEventListener(FILE_EVENT, onFileEvent);
  window.addEventListener('request-create-template', onCreateTemplateFromSelection);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown as EventListener);
  window.removeEventListener('search-fly-to', onSearchFlyTo);
  window.removeEventListener(EXTERNAL_CHANGE_EVENT, onExternalChange);
  window.removeEventListener(FILE_EVENT, onFileEvent);
  window.removeEventListener('request-create-template', onCreateTemplateFromSelection);
});

// --- File event handler (notifications from file-service) ---
function onFileEvent(e: Event) {
  const { type, key, params } = (e as CustomEvent).detail as { type: 'success' | 'error'; key: string; params?: Record<string, any> };
  const msg = t(key, params ?? {});
  if (type === 'success') {
    message.success(msg);
  } else {
    message.error(msg);
  }
}

// --- File external change handler ---
function onExternalChange(e: Event) {
  const detail = (e as CustomEvent).detail as { path: string };
  // Use simple confirm for now; can be replaced with a proper dialog
  if (window.confirm(t('fileService.externalChange', { path: detail.path }))) {
    reloadCurrentFile();
  }
}

// --- Template creation from selection ---
function onCreateTemplateFromSelection() {
  const selectedIds = nodes.value.filter((n: any) => n.selected && n.type !== 'group').map((n: any) => n.id);
  if (selectedIds.length < 2) {
    window.dispatchEvent(new CustomEvent('template-create-result', { detail: { success: false, message: 'Select at least 2 nodes on the canvas' } }));
    return;
  }
  tplSelectedIds.length = 0;
  tplSelectedIds.push(...selectedIds);
  tplNamePromptVisible.value = true;
}

function onTemplateNameConfirm(name: string) {
  store.createTemplateFromSelection(tplSelectedIds, name);
  tplNamePromptVisible.value = false;
  tplSelectedIds.length = 0;
}
</script>

<style scoped>
.editor {
  width: 100vw;
  height: 100vh;
  display: flex;
  overflow: hidden;
  background: var(--bg-color);
}

.canvas-wrap {
  flex: 1;
  height: 100%;
  position: relative;
}

.canvas-toolbar {
  position: absolute; top: 8px; left: 8px; z-index: 10;
  display: flex; gap: 6px;
}
.toolbar-btn {
  background-color: var(--bg-color);
  color: var(--text-primary);
  border: 2px solid var(--border-default);
  border-radius: var(--radius-md);
  padding: 4px 10px;
  font-size: 11px;
  font-family: var(--font-ui), sans-serif;
  cursor: pointer;
  box-shadow: 4px 4px 0px var(--text-primary);
  transition: transform var(--transition-fast) var(--ease-smooth),
              box-shadow var(--transition-fast) var(--ease-smooth);
}
.toolbar-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 5px 5px 0px var(--text-primary);
}
.toolbar-btn:active {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0px var(--text-primary);
}

.file-menu-wrap {
  position: relative;
}

.file-dropdown {
  position: absolute;
  top: 36px;
  left: 0;
  min-width: 180px;
  z-index: 10000;
}

.menu-shortcut {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.toolbar-btn.icon-toolbar-btn {
  width: 30px;
  height: 30px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.settings-form {
  padding: var(--spacing-md) 0;
}
.settings-form .form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.settings-form label {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 900;
  text-transform: uppercase;
  color: var(--text-primary);
}

.settings-section {
  margin-top: var(--spacing-lg);
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.shortcut-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--spacing-md);
  width: 100%;
  padding: var(--spacing-sm);
  border: var(--border-width-md) solid var(--border-default);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: var(--shadow-node);
}

.shortcut-row.capturing {
  border-color: var(--accent-blue);
  background: var(--bg-hover);
}

.shortcut-row span {
  text-align: left;
}

.shortcut-row kbd {
  min-width: 104px;
  padding: 3px 6px;
  border: var(--border-width-sm) solid var(--border-default);
  background: var(--panel-bg);
  color: var(--text-primary);
  text-align: center;
  font-family: var(--font-mono);
  font-size: 11px;
}

.reset-shortcuts-btn {
  width: 100%;
  margin-top: var(--spacing-md);
  padding: 8px 12px;
  border: var(--border-width-md) solid var(--border-default);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
  cursor: pointer;
}

</style>

<style>
/* BOM hover highlight/dim — global because Vue Flow nodes are rendered outside scoped context */
.bom-highlight {
  filter: brightness(1.3) drop-shadow(0 0 6px var(--accent-amber));
  z-index: 50 !important;
  transition: filter 0.15s ease;
}

.bom-dimmed {
  opacity: 0.25;
  transition: opacity 0.2s ease;
}

/* 选中节点的一跳关联高亮由 Vue Flow class 驱动，主画布节点和小地图节点共享同名状态类。 */
.vue-flow__node.selection-highlight {
  opacity: 1;
  transition: opacity var(--transition-fast) var(--ease-smooth),
              filter var(--transition-fast) var(--ease-smooth);
}

.vue-flow__node.selection-highlight .item-node,
.vue-flow__node.selection-highlight .group-node {
  border-color: var(--accent-amber);
  box-shadow: var(--shadow-node-hover);
}

.vue-flow__node.selection-focus {
  z-index: 60 !important;
}

.vue-flow__node.selection-focus .item-node,
.vue-flow__node.selection-focus .group-node {
  border-color: var(--accent-red);
}

.vue-flow__node.selection-dimmed {
  opacity: 0.24;
  transition: opacity var(--transition-fast) var(--ease-smooth);
}

.vue-flow__edge.selection-edge-highlight {
  z-index: 40;
}

.vue-flow__minimap-node.selection-highlight {
  opacity: 1;
  stroke: var(--accent-amber);
}

.vue-flow__minimap-node.selection-focus {
  stroke: var(--accent-red);
}

.vue-flow__minimap-node.selection-dimmed {
  opacity: 0.24;
}

.settings-modal {
  width: 480px;
  max-width: calc(100vw - 32px);
  --n-border-radius: var(--radius-sm);
  --n-color: var(--panel-bg);
  --n-text-color: var(--text-primary);
  --n-title-text-color: var(--text-primary);
  box-shadow: var(--shadow-modal);
}
</style>
