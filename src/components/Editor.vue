<template>
  <div class="editor">
    <DictionaryPanel />
    <div class="canvas-wrap">
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
      </VueFlow>
    </div>
    <SearchOverlay v-if="showSearch" @close="showSearch = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, provide, watch, onMounted, onUnmounted, markRaw } from 'vue';
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
import DictionaryPanel from './DictionaryPanel.vue';
import SearchOverlay from './SearchOverlay.vue';

const store = useStore();

// --- Vue Flow setup ---
const { setCenter } = useVueFlow();

const nodeTypes: any = { item: markRaw(ItemNode) };

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

  // Sync edges
  const storeEdgeIds = new Set(store.edges.map(e => e.id));
  edges.value = edges.value.filter(e => storeEdgeIds.has(e.id as string));
  for (const se of store.edges) {
    const existing = edges.value.find(e => e.id === se.id);
    if (existing) {
      existing.label = `x${se.quantity}`;
      existing.type = 'simplebezier';
      existing.animated = true;
      existing.style = se.edge_type === 'byproduct'
        ? { stroke: '#3b82f6', strokeWidth: 1.5, opacity: 0.7 }
        : { stroke: '#64748b', strokeWidth: 2, opacity: 0.8 };
      existing.markerEnd = undefined;
    } else {
      edges.value.push(buildFlowEdge(se));
    }
  }
}

// Watch for structural changes
watch(
  () => [store.nodes.length, store.edges.length, store.changeCounter],
  () => { syncFromStore(); },
  { flush: 'sync' },
);

// --- Drag tracking ---
const dragStartPositions = new Map<string, { x: number; y: number }>();

const NODE_W = 170;
const NODE_H = 60;
const NODE_GAP = 20;

function runCollision(anchoredIds: Set<string>) {
  const simNodes = nodes.value.map(n => {
    const cx = n.position.x + NODE_W / 2;
    const cy = n.position.y + NODE_H / 2;
    const anchored = anchoredIds.has(n.id);
    return { id: n.id, x: cx, y: cy, fx: anchored ? cx : undefined, fy: anchored ? cy : undefined };
  });

  const simulation = forceSimulation(simNodes)
    .force('collide', forceCollide((NODE_W + NODE_GAP) / 2))
    .stop();

  while (simulation.alpha() > 0.001) {
    simulation.tick();
  }
  simulation.stop();

  // Direct update on local Vue Flow nodes (bypass store)
  for (const sn of simNodes) {
    if (anchoredIds.has(sn.id)) continue;
    const vn = nodes.value.find(n => n.id === sn.id);
    if (!vn) continue;
    const nx = sn.x - NODE_W / 2;
    const ny = sn.y - NODE_H / 2;
    if (vn.position.x !== nx || vn.position.y !== ny) {
      vn.position = { x: nx, y: ny };
    }
  }
}

function onDragStart(_event: { nodes: { id: string; position: { x: number; y: number } }[] }) {
  // Snapshot ALL node positions so undo captures pushed nodes too
  for (const n of nodes.value) {
    dragStartPositions.set(n.id, { ...n.position });
  }
}

function onDrag(event: { nodes: { id: string; position: { x: number; y: number } }[] }) {
  const anchoredIds = new Set(event.nodes.map(n => n.id));
  runCollision(anchoredIds);
}

function onDragStop(event: { nodes: { id: string; position: { x: number; y: number } }[] }) {
  // Final collision pass
  const anchoredIds = new Set(event.nodes.map(n => n.id));
  runCollision(anchoredIds);

  // Collect all position changes (dragged + pushed) into one atomic undo entry
  const moves: Array<{ id: string; from: { x: number; y: number }; to: { x: number; y: number } }> = [];
  for (const vn of nodes.value) {
    const from = dragStartPositions.get(vn.id);
    if (from && (from.x !== vn.position.x || from.y !== vn.position.y)) {
      moves.push({ id: vn.id, from, to: { ...vn.position } });
      // Also update store position directly
      const sn = store.nodes.find(n => n.id === vn.id);
      if (sn) {
        sn.position.x = vn.position.x;
        sn.position.y = vn.position.y;
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

// --- Keyboard shortcuts ---
function onKeydown(e: KeyboardEvent) {
  const ctrl = e.ctrlKey || e.metaKey;

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
</style>
