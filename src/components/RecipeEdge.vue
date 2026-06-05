<template>
  <BaseEdge
    :id="id"
    :path="route.path"
    :style="style"
    :marker-start="markerStart"
    :marker-end="markerEnd"
    :interaction-width="interactionWidth"
  />
  <EdgeLabelRenderer v-if="labelText">
    <div
      class="recipe-edge-label nodrag nopan"
      :class="[`edge-${edgeType}`, selectionLabelClass]"
      :style="labelStyle"
    >
      {{ labelText }}
    </div>
  </EdgeLabelRenderer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from '@vue-flow/core';
import {
  getRecipeEdgeRoute,
  type RecipeEdgeStyle,
} from '../layout/edge-routing';
import type { FlowEdge, LayoutDirection } from '../store';

interface RecipeEdgeData {
  edgeStyle: RecipeEdgeStyle;
  edgeType: FlowEdge['edge_type'];
  layoutDirection: LayoutDirection;
  laneIndex: number;
  laneCount: number;
  selectionState?: 'highlight' | 'dimmed';
}

const props = defineProps<EdgeProps<RecipeEdgeData>>();

const edgeType = computed(() => props.data?.edgeType ?? 'input');
const labelText = computed(() => typeof props.label === 'string' ? props.label : '');
const selectionLabelClass = computed(() => {
  // 边标签跟随画布选中高亮状态：关联边标签突出显示，非关联边标签降低视觉权重。
  return props.data?.selectionState ? `selection-label-${props.data.selectionState}` : '';
});

const route = computed(() => getRecipeEdgeRoute({
  sourceX: props.sourceX,
  sourceY: props.sourceY,
  targetX: props.targetX,
  targetY: props.targetY,
  direction: props.data?.layoutDirection ?? 'BT',
  edgeStyle: props.data?.edgeStyle ?? 'simplebezier',
  laneIndex: props.data?.laneIndex ?? 0,
  laneCount: props.data?.laneCount ?? 1,
}));

const labelStyle = computed(() => ({
  transform: `translate(-50%, -50%) translate(${route.value.labelX}px, ${route.value.labelY}px)`,
}));
</script>

<style scoped>
.recipe-edge-label {
  position: absolute;
  padding: 1px 5px;
  border: var(--border-width-sm) solid var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--bg-context);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 800;
  line-height: 1.2;
  pointer-events: all;
  white-space: nowrap;
  box-shadow: var(--shadow-node);
}

.recipe-edge-label.edge-byproduct {
  border-color: var(--accent-tan);
}

.recipe-edge-label.edge-catalyst {
  border-color: var(--accent-blue);
}

.recipe-edge-label.selection-label-highlight {
  border-color: var(--accent-amber);
  background: var(--accent-amber);
  color: var(--border-default);
  box-shadow: var(--shadow-node-hover);
}

.recipe-edge-label.selection-label-dimmed {
  opacity: 0.18;
}
</style>
