<template>
  <div class="editor">
    <DictionaryPanel />
    <div ref="canvasWrapRef" class="canvas-wrap">
      <div class="canvas-toolbar">
        <button type="button" class="toolbar-btn" @click="store.deleteOrphans()" title="Delete all orphan nodes">
          Clean Orphans
        </button>
      </div>
      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        :node-types="nodeTypes"
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
        @pane-click="closePopover"
        @connect="onConnect"
        @nodes-change="onNodesChange"
        @edges-change="onEdgesChange"
        @connect-start="isConnecting = true"
        @connect-end="isConnecting = false"
        @edge-double-click="onEdgeDoubleClick"
        @viewport-change="onViewportChange"
      >
        <Background :gap="20" pattern-color="#1a1d24" />
        <Controls position="bottom-right" />
        <MiniMap position="bottom-right" />
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
    </div>
    <SearchOverlay v-if="showSearch" @close="showSearch = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, provide, watch, onMounted, onUnmounted, markRaw, computed } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import dagre from '@dagrejs/dagre';
import { forceSimulation, forceCollide } from 'd3-force';
import type { Connection, NodeChange, EdgeChange, EdgeMouseEvent } from '@vue-flow/core';
import type { FlowEdge, RecipeSlot } from '../store';
import { useStore } from '../store';
import { mockNodes, mockEdges, mockMachines } from '../data/mock-data';
import ItemNode from './ItemNode.vue';
import NodePopover from './NodePopover.vue';
import NodeDrawer from './NodeDrawer.vue';
import GroupNode from './GroupNode.vue';
import DictionaryPanel from './DictionaryPanel.vue';
import SearchOverlay from './SearchOverlay.vue';

const store = useStore();
const { setCenter, viewport } = useVueFlow();

const nodeTypes: any = { item: markRaw(ItemNode), group: markRaw(GroupNode) };

const defaultEdgeOptions = {
  type: 'simplebezier',
  animated: true,
  style: { stroke: '#64748b', strokeWidth: 2, opacity: 0.8 },
};

// --- Provide isConnecting for ItemNode ---
const isConnecting = ref(false);
provide('isConnecting', isConnecting);

// --- Local nodes/edges for Vue Flow ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodes = ref<any[]>([]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const edges = ref<any[]>([]);

// --- Orphan detection ---
function isOrphan(nodeId: string): boolean {
  const hasIncoming = store.edges.some(e => e.target === nodeId);
  const hasOutgoing = store.edges.some(e => e.source === nodeId);
  return !hasIncoming && !hasOutgoing;
}

// --- Build Vue Flow objects from store ---
function applyLayout() {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'BT', nodesep: 60, ranksep: 80, align: 'UL' });
  g.setDefaultEdgeLabel(() => ({}));

  store.nodes.forEach(n => {
    g.setNode(n.id, { width: 170, height: 60 });
  });

  store.edges.forEach(e => {
    g.setEdge(e.source, e.target);
  });

  dagre.layout(g);

  store.nodes.forEach(n => {
    const nodeWithPos = g.node(n.id);
    if (!nodeWithPos) return;
    const newPos = {
      x: nodeWithPos.x - nodeWithPos.width / 2,
      y: nodeWithPos.y - nodeWithPos.height / 2
    };
    if (n.position.x !== newPos.x || n.position.y !== newPos.y) {
      n.position = newPos; // Update direct to skip store move history for initial layout, or use moves.
    }
  });

  // Fit view after a small delay to ensure rendering
  setTimeout(() => {
    // Optionally fitView()
  }, 50);
}

function buildFlowEdge(se: FlowEdge) {
  const isByproduct = se.edge_type === 'byproduct';
  return {
    id: se.id,
    source: se.source,
    target: se.target,
    sourceHandle: 'source',
    targetHandle: se.target_slot_id,
    type: 'simplebezier',
    animated: true,
    label: `x${se.quantity}`,
    style: isByproduct
      ? { stroke: '#3b82f6', strokeWidth: 1.5, opacity: 0.7 }
      : { stroke: '#64748b', strokeWidth: 2, opacity: 0.8 },
  };
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

  // Map node to its collapsed group for edge routing
  const nodeToCollapsedGroup = new Map<string, string>();
  for (const group of store.groups) {
    if (group.collapsed) {
      for (const childId of group.children) {
        nodeToCollapsedGroup.set(childId, group.id);
      }
    }
  }

  // Sync edges with rerouting
  const newEdges = [];
  for (const se of store.edges) {
    const sourceGroup = nodeToCollapsedGroup.get(se.source);
    const targetGroup = nodeToCollapsedGroup.get(se.target);

    // Hide internal edges inside a collapsed group
    if (sourceGroup && targetGroup && sourceGroup === targetGroup) {
      continue;
    }

    const displaySource = sourceGroup || se.source;
    const displayTarget = targetGroup || se.target;

    const edgeType = 'simplebezier';
    const edgeStyle = se.edge_type === 'byproduct'
      ? { stroke: '#3b82f6', strokeWidth: 1.5, opacity: 0.7, strokeDasharray: '5,5' }
      : { stroke: '#64748b', strokeWidth: 2, opacity: 0.8 };
    const animated = true;

    newEdges.push({
      id: se.id,
      source: displaySource,
      target: displayTarget,
      sourceHandle: sourceGroup ? undefined : 'source',
      targetHandle: targetGroup ? undefined : se.target_slot_id,
      type: edgeType,
      animated,
      label: `x${se.quantity}`,
      style: edgeStyle,
    });
  }
  edges.value = newEdges;

  // Handle group nodes
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
}

// Watch for structural changes
watch(
  () => [store.nodes.length, store.edges.length, store.changeCounter, store.groups.length],
  () => { syncFromStore(); },
  { flush: 'sync' },
);

// --- Drag tracking ---
const dragStartPositions = new Map<string, { x: number; y: number }>();

const NODE_W = 170;
const NODE_H = 60;
const NODE_GAP = 20;

function runCollision(anchoredIds: Set<string>) {
  // Only participate active roots in collision
  const activeNodes = nodes.value.filter((n: any) => {
    if (n.type === 'group' && !n.data.collapsed) return false;
    if (n.type === 'item') {
      const groupInfo = store.groups.find(g => g.children.includes(n.id as string) && !g.collapsed);
      if (groupInfo) return false;
    }
    return true;
  });

  const simNodes = activeNodes.map((n: any) => {
    const w = (n.type === 'group' && n.data.collapsed) ? 240 : NODE_W;
    const h = (n.type === 'group' && n.data.collapsed) ? 100 : NODE_H;
    const radius = Math.max(w, h) / 2 + NODE_GAP / 2;
    const cx = n.position.x + w / 2;
    const cy = n.position.y + h / 2;
    const anchored = anchoredIds.has(n.id);
    return { id: n.id, x: cx, y: cy, fx: anchored ? cx : undefined, fy: anchored ? cy : undefined, r: radius, w, h };
  });

  const simulation = forceSimulation(simNodes)
    .force('collide', forceCollide((d: any) => d.r))
    .stop();

  while (simulation.alpha() > 0.001) {
    simulation.tick();
  }
  simulation.stop();

  // Direct update on local Vue Flow nodes (bypass store)
  for (const sn of simNodes) {
    if (anchoredIds.has(sn.id)) continue;
    const vn = nodes.value.find((n: any) => n.id === sn.id);
    if (!vn) continue;
    let nx = sn.x - sn.w / 2;
    let ny = sn.y - sn.h / 2;

    if (vn.position.x !== nx || vn.position.y !== ny) {
      vn.position = { x: nx, y: ny };
    }
  }
}

function onDragStart(_event: { nodes: { id: string; type: string; position: { x: number; y: number } }[] }) {
  // Snapshot ALL node positions so undo captures pushed nodes too
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

  const anchoredIds = new Set(event.nodes.map(n => n.id));
  runCollision(anchoredIds);
}

function onDragStop(event: { nodes: { id: string; type: string; position: { x: number; y: number } }[] }) {
  // Final collision pass
  const anchoredIds = new Set(event.nodes.map(n => n.id));
  runCollision(anchoredIds);

  // Collect all position changes (dragged + pushed) into one atomic undo entry
  const moves: Array<{ id: string; type?: 'node' | 'group'; from: { x: number; y: number }; to: { x: number; y: number } }> = [];
  for (const vn of nodes.value) {
    const from = dragStartPositions.get(vn.id as string);
    if (from && (from.x !== vn.position.x || from.y !== vn.position.y)) {
      moves.push({ id: vn.id as string, type: vn.type === 'group' ? 'group' : 'node', from, to: { ...vn.position } });
      // Also update store position directly
      if (vn.type === 'group') {
        const sg = store.groups.find(g => g.id === vn.id);
        if (sg) {
          sg.position = { ...vn.position };
          // If group is collapsed, manually apply translation to its hidden children
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
        name: 'Default',
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
  // Immediate visual feedback — push to local edges
  edges.value.push(buildFlowEdge(newEdge));
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

function onNodesChange(changes: NodeChange[]) {
  for (const c of changes) {
    if (c.type === 'remove') {
      pendingRemovals.push({ type: 'node', id: c.id });
    }
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

// --- Edge double-click: edit quantity ---
function onEdgeDoubleClick(event: EdgeMouseEvent) {
  const edgeId = event.edge.id as string;
  const storeEdge = store.edges.find(e => e.id === edgeId);
  const currentQty = storeEdge?.quantity || 1;
  const input = prompt('Edge quantity:', String(currentQty));
  if (input !== null) {
    const qty = parseInt(input, 10);
    if (!isNaN(qty) && qty > 0) {
      store.updateEdge(edgeId, { quantity: qty });
    }
  }
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

// --- Drawer state ---
const drawerVisible = ref(false);
const drawerNode = ref<any>(null);

watch(drawerVisible, (val) => {
  if (val) {
    document.body.classList.add('drawer-open');
  } else {
    document.body.classList.remove('drawer-open');
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
  if (event.dataTransfer?.types.includes('text/plain')) {
    event.preventDefault();
  }
}

function onDropOnCanvas(event: DragEvent) {
  const raw = event.dataTransfer?.getData('text/plain');
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (data.type !== 'dictionary-item') return;
    const nodeId = data.nodeId;
    if (!store.isNodeOnCanvas(nodeId)) {
      // Place at drop position — approximate flow coords
      const canvasEl = document.querySelector('.canvas-wrap');
      const rect = canvasEl?.getBoundingClientRect();
      if (!rect) return;
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      store.placeNodeOnCanvas(nodeId, { x, y });
      syncFromStore();
    } else {
      // Already on canvas — fly to it
      const node = store.nodes.find(n => n.id === nodeId);
      if (node) {
        window.dispatchEvent(new CustomEvent('search-fly-to', {
          detail: { x: node.position.x, y: node.position.y },
        }));
      }
    }
  } catch { /* ignore */ }
}

// --- Group helpers ---
function createGroupFromSelection() {
  const selectedIds = nodes.value
    .filter((n: any) => n.selected && n.type === 'item')
    .map((n: any) => n.id as string);
  if (selectedIds.length < 2) return;
  store.addGroup('New Group', selectedIds);
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
  const ctrl = e.ctrlKey || e.metaKey;

  if (ctrl && !e.shiftKey && e.key === 'g') {
    e.preventDefault();
    createGroupFromSelection();
    return;
  }
  if (ctrl && e.shiftKey && e.key === 'G') {
    e.preventDefault();
    disbandSelectedGroup();
    return;
  }

  if (ctrl && e.key === 'z') {
    e.preventDefault();
    store.undo();
  } else if (ctrl && e.key === 'y') {
    e.preventDefault();
    store.redo();
  } else if (ctrl && e.key === 'p') {
    e.preventDefault();
    showSearch.value = !showSearch.value;
  } else if (e.key === 'Escape' && showSearch.value) {
    showSearch.value = false;
  }
}

// --- Lifecycle ---
onMounted(() => {
  // Seed mock data
  store.seedData({ nodes: mockNodes, edges: mockEdges, machines: mockMachines });
  applyLayout();
  syncFromStore();

  // Keyboard listener on window (for shortcuts even when canvas not focused)
  window.addEventListener('keydown', onKeydown as EventListener);
  window.addEventListener('search-fly-to', onSearchFlyTo);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown as EventListener);
  window.removeEventListener('search-fly-to', onSearchFlyTo);
});
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
}
.toolbar-btn {
  background: var(--bg-surface); border: 1px solid var(--border-default);
  border-radius: var(--radius-md); padding: 5px 10px;
  color: var(--text-muted); font-size: 10px; cursor: pointer;
  font-family: var(--font-ui), sans-serif;
}
.toolbar-btn:hover { color: var(--text-primary); border-color: var(--accent-link); }
</style>
