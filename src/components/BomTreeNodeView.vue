<template>
  <div class="bom-tree-node" :style="{ marginLeft: depth > 0 ? '24px' : '0' }">
    <!-- Node header -->
    <div
      class="node-row"
      :class="{
        'raw': node.isRawMaterial,
        'byproduct': node.isByproduct,
        'surplus': node.isSurplus,
        'blocked': node.isCatalystBlocked,
        'cycle': node.isCycleDetected,
      }"
      @mouseenter="$emit('highlight', node.nodeId)"
      @mouseleave="$emit('highlight', null)"
    >
      <span class="node-dot" :style="{ background: node.nodeColor }"></span>
      <span class="node-name">{{ node.nodeName }}</span>
      <span class="node-slot">{{ node.slotName }}</span>

      <!-- One-time mode -->
      <template v-if="mode === 'one-time'">
        <span class="node-qty" v-if="node.executionCount !== undefined">
          ×{{ node.executionCount }}
        </span>
        <span class="node-mul prolif" v-if="node.proliferatorMultiplier">
          ×{{ node.proliferatorMultiplier }}
        </span>
        <span class="node-mul global" v-if="node.globalYieldMultiplier">
          ×{{ fmtNum(node.globalYieldMultiplier) }}
        </span>
        <span class="node-total mono" v-if="node.executionCount !== undefined && !node.isRawMaterial">
          = {{ node.targetQuantity }}
        </span>
      </template>

      <!-- Continuous mode -->
      <template v-if="mode === 'continuous'">
        <span class="node-machines mono" v-if="node.machineCount !== undefined">
          {{ fmtNum(node.machineCount) }} {{ $t('bom.machines') }}
        </span>
        <span class="node-rate mono" v-if="node.actualOutputRate !== undefined">
          {{ fmtNum(node.actualOutputRate) }}{{ $t('bom.perMin') }}
        </span>
      </template>

      <!-- Flags -->
      <span v-if="node.isRawMaterial" class="flag raw">{{ $t('bom.raw') }}</span>
      <span v-if="node.isByproduct" class="flag bp">{{ $t('bom.bp') }}</span>
      <span v-if="node.isSurplus && node.surplusPercent !== undefined" class="flag surplus">
        {{ $t('bom.surplus', { pct: node.surplusPercent.toFixed(1) }) }}
      </span>
      <span v-if="node.isCatalystBlocked" class="flag blocked">{{ $t('bom.noCat') }}</span>
      <span v-if="node.isCycleDetected" class="flag cycle">{{ $t('bom.cycle') }}</span>
    </div>

    <!-- Input edges + child trees -->
    <div v-if="node.inputs.length > 0" class="inputs-list">
      <div v-for="edge in node.inputs" :key="edge.edgeId" class="edge-line">
        <div class="edge-indicator">
          <span class="edge-arrow">→</span>
          <span class="edge-source">{{ edge.sourceNodeName }}</span>
          <span class="edge-qty mono">×{{ fmtNum(edge.quantity) }}</span>
        </div>
        <BomTreeNodeView
          v-if="edge.child"
          :node="edge.child"
          :mode="mode"
          :depth="depth + 1"
          @highlight="(id: string | null) => $emit('highlight', id)"
        />
        <div v-else class="raw-leaf">
          <span class="node-dot" :style="{ background: edge.sourceNodeColor }"></span>
          <span class="node-name">{{ edge.sourceNodeName }}</span>
          <span class="flag raw">{{ $t('bom.raw') }}</span>
        </div>
      </div>
    </div>

    <!-- Catalyst at this node -->
    <div v-if="node.catalyst" class="catalyst-line">
      <div class="edge-indicator">
        <span class="edge-arrow cat-arrow">→</span>
        <span class="edge-source cat-label">{{ node.catalyst.sourceNodeName }}</span>
        <span class="edge-qty mono">×{{ fmtNum(node.catalyst.quantity) }}</span>
        <span class="flag cat">{{ $t('bom.cat') }}</span>
      </div>
    </div>

    <!-- Byproducts at this node -->
    <div v-if="node.byproducts.length > 0" class="byproducts-list">
      <div v-for="bp in node.byproducts" :key="bp.itemId" class="bp-row" :class="{ consumed: (bp.offsetConsumed ?? 0) > 0 }">
        <span class="bp-arrow">↗</span>
        <span class="node-dot small" :style="{ background: bp.itemColor }"></span>
        <span class="bp-name">{{ bp.itemName }}</span>
        <span class="bp-qty mono">×{{ fmtNum(bp.quantity) }}</span>
        <span v-if="bp.offsetConsumed" class="bp-offset mono">(−{{ fmtNum(bp.offsetConsumed) }})</span>
        <span class="flag bp">{{ $t('bom.bp') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BomTreeNode, CalculationMode } from '../bom';

defineProps<{
  node: BomTreeNode;
  mode: CalculationMode;
  depth: number;
}>();

defineEmits<{
  highlight: [id: string | null];
}>();

function fmtNum(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
}
</script>

<style scoped>
.bom-tree-node {
  position: relative;
}

.node-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border: var(--border-width-md) solid var(--border-default);
  background: var(--bg-surface);
  margin-bottom: 2px;
  cursor: default;
  transition: background var(--transition-fast), transform var(--transition-fast);
  box-shadow: var(--shadow-node);
  font-size: 11px;
}

.node-row:hover {
  background: var(--bg-hover);
  transform: translateX(2px);
}

.node-row.raw { border-left: 3px solid var(--text-muted); }
.node-row.byproduct { border-left: 3px solid var(--accent-tan); }
.node-row.surplus { border-left: 3px solid var(--accent-red); }
.node-row.blocked { border-left: 3px solid var(--accent-red); opacity: 0.6; }
.node-row.cycle { border-left: 3px solid var(--accent-amber); opacity: 0.6; }

.node-dot {
  width: 10px; height: 10px;
  border: var(--border-width-sm) solid var(--border-default);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
.node-dot.small { width: 8px; height: 8px; }

.node-name {
  font-weight: 800;
  color: var(--text-primary);
  flex-shrink: 0;
}

.node-slot {
  font-size: 9px;
  color: var(--text-muted);
  font-style: italic;
}

.node-mul {
  font-weight: 700;
}

.node-mul.prolif {
  color: var(--accent-green);
}

.node-mul.global {
  color: var(--accent-red);
}

.node-qty {
  color: var(--text-main);
  font-weight: 700;
}

.node-total, .node-rate, .node-machines {
  color: var(--text-muted);
  margin-left: auto;
}

.flag {
  font-size: 8px;
  font-weight: 900;
  text-transform: uppercase;
  padding: 1px 4px;
  border-radius: var(--radius-sm);
}
.flag.raw { background: var(--text-muted); color: var(--bg-color); }
.flag.bp { background: var(--accent-tan); color: #fff; }
.flag.surplus { background: var(--accent-red); color: #fff; }
.flag.blocked { background: var(--accent-red); color: #fff; }
.flag.cycle { background: var(--accent-amber); color: var(--text-primary); }

.mono {
  font-family: var(--font-mono);
  font-weight: 800;
}

.inputs-list {
  position: relative;
  margin-left: 12px;
  padding-left: 8px;
  border-left: var(--border-width-md) solid var(--border-subtle);
}

.edge-line {
  margin-bottom: 2px;
}

.edge-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 0;
  font-size: 11px;
  color: var(--text-muted);
}

.edge-arrow {
  color: var(--text-dimmed);
  font-size: 10px;
}

.edge-source {
  color: var(--text-muted);
}

.edge-qty {
  color: var(--text-main);
}

.raw-leaf {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  margin-left: 20px;
  font-size: 11px;
  opacity: 0.7;
}

.catalyst-line {
  margin-left: 12px;
  padding-left: 8px;
  border-left: var(--border-width-md) solid var(--accent-blue);
  margin-top: 2px;
  margin-bottom: 2px;
}

.cat-arrow { color: var(--accent-blue); }
.cat-label { color: var(--accent-blue); }

.flag.cat { background: var(--accent-blue); color: #fff; }

.byproducts-list {
  margin-left: 12px;
  padding-left: 8px;
  border-left: var(--border-width-sm) dashed var(--accent-tan);
  margin-top: 2px;
  margin-bottom: 6px;
}

.bp-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 0;
  font-size: 10px;
}

.bp-arrow { color: var(--accent-tan); font-size: 10px; }
.bp-name { color: var(--accent-tan); }
.bp-qty { color: var(--accent-tan); }
.bp-offset { color: var(--accent-green); font-size: 9px; }
.bp-row.consumed { opacity: 0.6; }
</style>
