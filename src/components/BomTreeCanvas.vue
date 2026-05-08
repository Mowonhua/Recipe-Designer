<template>
  <div class="bom-tree-canvas" ref="canvasRef" @mousedown.prevent="onMouseDown" @wheel="onWheel">
    <div
      class="canvas-world"
      :style="{
        width: layoutData.worldW + 'px',
        height: layoutData.worldH + 'px',
        transform: worldTransform,
      }"
    >
      <template v-for="ln in layoutData.nodes" :key="ln.node.nodeId">
        <div
          class="tree-node"
          :class="{
            'raw': ln.node.isRawMaterial,
            'byproduct': ln.node.isByproduct,
            'surplus': ln.node.isSurplus,
            'blocked': ln.node.isCatalystBlocked,
            'cycle': ln.node.isCycleDetected,
          }"
          :style="{ left: ln.x + 'px', top: ln.y + 'px', width: ln.w + 'px' }"
          @mouseenter="emit('highlight', ln.node.nodeId)"
          @mouseleave="emit('highlight', null)"
        >
          <span class="n-dot" :style="{ background: ln.node.nodeColor }"></span>
          <span class="n-name">{{ ln.node.nodeName }}</span>
          <span class="n-slot">{{ ln.node.slotName }}</span>

          <template v-if="mode === 'one-time'">
            <span class="n-qty" v-if="ln.node.executionCount !== undefined">×{{ ln.node.executionCount }}</span>
            <span class="n-mul prolif" v-if="ln.node.proliferatorMultiplier">×{{ ln.node.proliferatorMultiplier }}</span>
            <span class="n-mul global" v-if="ln.node.globalYieldMultiplier">×{{ fmtNum(ln.node.globalYieldMultiplier) }}</span>
            <span class="n-total" v-if="ln.node.executionCount !== undefined && !ln.node.isRawMaterial">
              = {{ ln.node.targetQuantity }}
            </span>
          </template>

          <template v-if="mode === 'continuous'">
            <span class="n-mach" v-if="ln.node.machineCount !== undefined">
              {{ fmtNum(ln.node.machineCount) }} {{ $t('bom.machines') }}
            </span>
            <span class="n-rate" v-if="ln.node.actualOutputRate !== undefined">
              {{ fmtNum(ln.node.actualOutputRate) }}{{ $t('bom.perMin') }}
            </span>
          </template>

          <span v-if="ln.node.isRawMaterial" class="flag raw">{{ $t('bom.raw') }}</span>
          <span v-if="ln.node.isByproduct" class="flag bp">{{ $t('bom.bp') }}</span>
          <span v-if="ln.node.isSurplus && ln.node.surplusPercent !== undefined" class="flag surplus">
            {{ $t('bom.surplus', { pct: ln.node.surplusPercent.toFixed(1) }) }}
          </span>
          <span v-if="ln.node.isCatalystBlocked" class="flag blocked">{{ $t('bom.noCat') }}</span>
          <span v-if="ln.node.isCycleDetected" class="flag cycle">{{ $t('bom.cycle') }}</span>
        </div>

        <!-- Connectors for this node's children -->
        <template v-if="ln.children.length > 0">
          <!-- Vertical trunk: drops from node bottom at trunkX -->
          <div
            class="conn-v"
            :style="{
              left: (ln.x + HALF_INDENT) + 'px',
              top: (ln.y + NODE_H) + 'px',
              height: (lastChildMidY(ln) - (ln.y + NODE_H)) + 'px',
            }"
          ></div>
          <!-- Horizontal branch to each child -->
          <div
            v-for="child in ln.children"
            :key="'conn-' + child.node.nodeId"
            class="conn-h"
            :style="{
              left: (ln.x + HALF_INDENT) + 'px',
              top: (child.y + NODE_H / 2) + 'px',
              width: (child.x - (ln.x + HALF_INDENT)) + 'px',
            }"
          ></div>
          <!-- Edge labels with quantities -->
          <template v-for="edge in ln.node.inputs" :key="'lbl-' + edge.edgeId">
            <div
              v-if="edge.child"
              class="edge-label"
              :style="{
                left: (ln.x + HALF_INDENT + 4) + 'px',
                top: getChildY(edge.child.nodeId) + 'px',
              }"
            >×{{ fmtNum(edge.quantity) }}</div>
          </template>
        </template>
      </template>
    </div>

    <!-- Hidden measurement probe -->
    <div class="measure-probe" ref="measureRef"></div>

    <div class="canvas-hint">
      <span>🖱 {{ $t('bom.dragToPan') }}</span>
      <span>⚙ Ctrl+Wheel</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import type { BomTreeNode, BomTreeEdge, BomByproduct, CalculationMode } from '../bom';

/* ============================================
   Module-level pan/drag state (non-reactive)
   ============================================ */
let dragging = false;
let lastX = 0;
let lastY = 0;

/* ============================================
   Layout Constants
   ============================================ */
const INDENT = 56;
const HALF_INDENT = 28;
const NODE_H = 34;
const V_GAP = 10;
const V_SIB = 6;
const PAD = 32;
const MIN_NODE_W = 200;

/* ============================================
   LayoutNode interface
   ============================================ */
interface LayoutNode {
  node: BomTreeNode;
  x: number;
  y: number;
  w: number;
  depth: number;
  children: LayoutNode[];
  catalyst?: BomTreeEdge;
  byproducts: BomByproduct[];
  proliferator?: BomTreeEdge;
}

/* ============================================
   Props & Emits
   ============================================ */
const props = defineProps<{
  tree: BomTreeNode;
  mode: CalculationMode;
}>();

const emit = defineEmits<{
  highlight: [id: string | null];
}>();

/* ============================================
   Refs
   ============================================ */
const canvasRef = ref<HTMLElement | null>(null);
const measureRef = ref<HTMLElement | null>(null);
const panX = ref(0);
const panY = ref(0);
const scale = ref(1);
const measureVersion = ref(0);

onMounted(() => {
  dragging = false;
  window.addEventListener('mousemove', onGlobalMouseMove);
  window.addEventListener('mouseup', onGlobalMouseUp);
  panX.value = 20;
  panY.value = 20;
  measureVersion.value++;
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onGlobalMouseMove);
  window.removeEventListener('mouseup', onGlobalMouseUp);
});

/* ============================================
   i18n
   ============================================ */
const { t } = useI18n();

/* ============================================
   Utilities
   ============================================ */
function fmtNum(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ============================================
   Helper Functions
   ============================================ */
function lastChildMidY(ln: LayoutNode): number {
  const last = ln.children[ln.children.length - 1];
  return last.y + NODE_H / 2;
}

function getChildY(childNodeId: string): number {
  return layoutData.value.childYMap.get(childNodeId) ?? 0;
}

/* ============================================
   Measurement
   ============================================ */
function measureNodeWidth(node: BomTreeNode): number {
  if (!measureRef.value) return MIN_NODE_W;

  const parts: string[] = [];

  // Dot
  parts.push(
    `<span class="n-dot" style="background:${escapeHtml(node.nodeColor)}"></span>`,
  );

  // Node name
  parts.push(
    `<span class="n-name">${escapeHtml(node.nodeName)}</span>`,
  );

  // Slot name
  parts.push(
    `<span class="n-slot">${escapeHtml(node.slotName)}</span>`,
  );

  // One-time mode quantities
  if (props.mode === 'one-time') {
    if (node.executionCount !== undefined) {
      parts.push(`<span class="n-qty">×${node.executionCount}</span>`);
    }
    if (node.proliferatorMultiplier) {
      parts.push(`<span class="n-mul prolif">×${node.proliferatorMultiplier}</span>`);
    }
    if (node.globalYieldMultiplier) {
      parts.push(`<span class="n-mul global">×${fmtNum(node.globalYieldMultiplier)}</span>`);
    }
    if (node.executionCount !== undefined && !node.isRawMaterial) {
      parts.push(`<span class="n-total">= ${node.targetQuantity}</span>`);
    }
  }

  // Continuous mode quantities
  if (props.mode === 'continuous') {
    if (node.machineCount !== undefined) {
      parts.push(
        `<span class="n-mach">${fmtNum(node.machineCount)} ${t('bom.machines')}</span>`,
      );
    }
    if (node.actualOutputRate !== undefined) {
      parts.push(
        `<span class="n-rate">${fmtNum(node.actualOutputRate)}${t('bom.perMin')}</span>`,
      );
    }
  }

  // Flags
  if (node.isRawMaterial) {
    parts.push(`<span class="flag raw">${t('bom.raw')}</span>`);
  }
  if (node.isByproduct) {
    parts.push(`<span class="flag bp">${t('bom.bp')}</span>`);
  }
  if (node.isSurplus && node.surplusPercent !== undefined) {
    parts.push(
      `<span class="flag surplus">${t('bom.surplus', { pct: node.surplusPercent.toFixed(1) })}</span>`,
    );
  }
  if (node.isCatalystBlocked) {
    parts.push(`<span class="flag blocked">${t('bom.noCat')}</span>`);
  }
  if (node.isCycleDetected) {
    parts.push(`<span class="flag cycle">${t('bom.cycle')}</span>`);
  }

  measureRef.value.innerHTML = parts.join('');
  const w = measureRef.value.scrollWidth;
  measureRef.value.innerHTML = '';
  return Math.max(MIN_NODE_W, w);
}

/* ============================================
   Layout Engine
   ============================================ */
function layoutTree(root: BomTreeNode): {
  nodes: LayoutNode[];
  worldW: number;
  worldH: number;
  childYMap: Map<string, number>;
} {
  const flat: LayoutNode[] = [];

  // Pass 1: Measure all nodes and build LayoutNode tree
  function build(node: BomTreeNode, depth: number): LayoutNode {
    const w = measureNodeWidth(node);
    const children: LayoutNode[] = [];

    for (const input of node.inputs) {
      if (input.child) {
        children.push(build(input.child, depth + 1));
      }
    }

    const ln: LayoutNode = {
      node,
      x: 0,
      y: 0,
      w,
      depth,
      children,
      catalyst: node.catalyst,
      byproducts: node.byproducts,
      proliferator: node.proliferator,
    };

    flat.push(ln);
    return ln;
  }

  const rootLn = build(root, 0);

  // Pass 2: Assign X/Y positions top-down
  function position(ln: LayoutNode, startY: number): number {
    ln.x = PAD + ln.depth * INDENT;
    ln.y = startY;

    if (ln.children.length === 0) {
      return startY + NODE_H;
    }

    let curY = startY + NODE_H + V_GAP;
    for (const child of ln.children) {
      curY = position(child, curY) + V_SIB;
    }
    return curY - V_SIB;
  }

  const totalH = position(rootLn, PAD);

  let maxX = 0;
  for (const ln of flat) {
    const rightEdge = ln.x + ln.w;
    if (rightEdge > maxX) maxX = rightEdge;
  }

  return {
    nodes: flat,
    worldW: Math.max(maxX + PAD, 400),
    worldH: totalH + PAD,
    childYMap: new Map(flat.map(n => [n.node.nodeId, n.y])),
  };
}

/* ============================================
   Interaction Handlers
   ============================================ */
function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return;
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
}

function onGlobalMouseMove(e: MouseEvent) {
  if (!dragging) return;
  panX.value += e.clientX - lastX;
  panY.value += e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
}

function onGlobalMouseUp() {
  dragging = false;
}

function onWheel(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    panX.value -= e.deltaX;
    panY.value -= e.deltaY;
  } else {
    e.preventDefault();
    const rect = canvasRef.value?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    const ns = Math.min(3, Math.max(0.25, scale.value * factor));
    panX.value = mx - (mx - panX.value) * (ns / scale.value);
    panY.value = my - (my - panY.value) * (ns / scale.value);
    scale.value = ns;
  }
}

/* ============================================
   Computed
   ============================================ */
const layoutData = computed(() => {
  void measureVersion.value; // recompute after mount when measureRef is available
  return layoutTree(props.tree);
});

const worldTransform = computed(() => {
  return `translate(${panX.value}px, ${panY.value}px) scale(${scale.value})`;
});
</script>

<style scoped>
/* ============================================
   Canvas Container
   ============================================ */
.bom-tree-canvas {
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 200px;
  border: var(--border-width-md) solid var(--border-default);
  background-color: var(--bg-color);
  background-image:
    linear-gradient(var(--border-subtle) 1px, transparent 1px),
    linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px);
  background-size: 32px 32px;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
}

.bom-tree-canvas:active {
  cursor: grabbing;
}

/* ============================================
   World Container
   ============================================ */
.canvas-world {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}

/* ============================================
   Node
   ============================================ */
.tree-node {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--bg-surface);
  border: var(--border-width-md) solid var(--border-default);
  box-shadow: var(--shadow-node);
  font-family: var(--font-mono);
  font-size: 11px;
  white-space: nowrap;
  cursor: default;
  transition: box-shadow var(--transition-fast), transform var(--transition-fast);
}
.tree-node:hover {
  box-shadow: var(--shadow-node-hover);
  transform: translate(-1px, -1px);
  z-index: 10;
}
.tree-node.raw { border-left: 3px solid var(--text-muted); opacity: 0.75; }
.tree-node.byproduct { border-left: 3px solid var(--accent-tan); }
.tree-node.surplus { border-left: 3px solid var(--accent-red); }
.tree-node.blocked { border-left: 3px solid var(--accent-red); opacity: 0.6; }
.tree-node.cycle { border-left: 3px solid var(--accent-amber); opacity: 0.6; }

.n-dot {
  width: 10px; height: 10px;
  border: var(--border-width-sm) solid var(--border-default);
  flex-shrink: 0;
}
.n-name { font-weight: 800; color: var(--text-primary); }
.n-slot { font-size: 9px; color: var(--text-muted); font-style: italic; }
.n-qty { color: var(--accent-blue); font-weight: 800; }
.n-total { color: var(--text-muted); font-weight: 700; margin-left: auto; }
.n-mach, .n-rate { color: var(--text-muted); margin-left: auto; font-size: 10px; }
.n-mul { font-weight: 700; }
.n-mul.prolif { color: var(--accent-green); }
.n-mul.global { color: var(--accent-red); }

.flag {
  font-size: 8px; font-weight: 900; text-transform: uppercase;
  padding: 1px 4px; color: #fff; display: inline-block;
}
.flag.raw { background: var(--text-muted); color: var(--bg-color); }
.flag.bp { background: var(--accent-tan); }
.flag.surplus { background: var(--accent-red); }
.flag.blocked { background: var(--accent-red); }
.flag.cycle { background: var(--accent-amber); color: var(--text-primary); }

/* ============================================
   Connectors
   ============================================ */
.conn-h, .conn-v {
  position: absolute;
  pointer-events: none;
  z-index: 0;
  background: var(--border-default);
}
.conn-h { height: var(--border-width-sm); }
.conn-v { width: var(--border-width-sm); }

.edge-label {
  position: absolute;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 800;
  color: var(--text-dimmed);
  white-space: nowrap;
  pointer-events: none;
  z-index: 1;
}

/* ============================================
   Measurement Probe
   ============================================ */
.measure-probe {
  position: absolute;
  visibility: hidden;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 11px;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--bg-surface);
  border: var(--border-width-md) solid var(--border-default);
  box-shadow: var(--shadow-node);
}

/* ---- Probe inner spans — match rendered node structure ---- */
.measure-probe :deep(.n-dot) {
  width: 10px; height: 10px;
  border: var(--border-width-sm) solid var(--border-default);
  flex-shrink: 0;
  display: inline-block;
}
.measure-probe :deep(.n-name) { font-weight: 800; color: var(--text-primary); display: inline; }
.measure-probe :deep(.n-slot) { font-size: 9px; color: var(--text-muted); font-style: italic; display: inline; }
.measure-probe :deep(.n-qty) { color: var(--accent-blue); font-weight: 800; display: inline; }
.measure-probe :deep(.n-total) { color: var(--text-muted); font-weight: 700; margin-left: auto; display: inline; }
.measure-probe :deep(.n-mach), .measure-probe :deep(.n-rate) { color: var(--text-muted); margin-left: auto; font-size: 10px; display: inline; }
.measure-probe :deep(.n-mul) { font-weight: 700; display: inline; }
.measure-probe :deep(.n-mul.prolif) { color: var(--accent-green); }
.measure-probe :deep(.n-mul.global) { color: var(--accent-red); }
.measure-probe :deep(.flag) {
  font-size: 8px; font-weight: 900; text-transform: uppercase;
  padding: 1px 4px; color: #fff; display: inline-block;
}
.measure-probe :deep(.flag.raw) { background: var(--text-muted); color: var(--bg-color); }
.measure-probe :deep(.flag.bp) { background: var(--accent-tan); }
.measure-probe :deep(.flag.surplus) { background: var(--accent-red); }
.measure-probe :deep(.flag.blocked) { background: var(--accent-red); }
.measure-probe :deep(.flag.cycle) { background: var(--accent-amber); color: var(--text-primary); }

/* ============================================
   Hint Overlay
   ============================================ */
.canvas-hint {
  position: absolute;
  bottom: 8px;
  right: 10px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dimmed);
  display: flex;
  gap: 12px;
  pointer-events: none;
  -webkit-user-select: none;
  user-select: none;
}
</style>
