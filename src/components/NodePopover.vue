<template>
  <Teleport to="body">
    <div
      v-if="visible && node"
      class="popover-backdrop"
    >
      <div
        ref="cardRef"
        class="popover-card"
        :style="{ left: position.x + 'px', top: position.y + 'px' }"
        @click.stop
        @keydown.escape="close"
        tabindex="-1"
      >
        <!-- Header -->
        <div class="popover-header">
          <div class="header-left">
            <span class="node-icon">
              <img v-if="iconIsImage" :src="node.icon" class="icon-img" />
              <span v-else>{{ node.icon || '' }}</span>
            </span>
            <div>
              <div class="node-name">{{ node.name }}</div>
              <div class="node-tags">{{ node.tags.join(' · ') || 'no tags' }}</div>
            </div>
          </div>
          <button type="button" class="details-btn" @click="openDrawer">Details →</button>
        </div>

        <!-- Active Recipe / Slots -->
        <div class="section-label">Active Recipe</div>
        <div class="slot-list">
          <div
            v-for="slot in node.slots"
            :key="slot.id"
            :class="['slot-row', { active: slot.id === node.active_slot_id }]"
            @click="switchSlot(slot.id)"
          >
            <div class="slot-info">
              <div class="slot-name">{{ slot.name }}</div>
              <div class="slot-meta">{{ slot.time }}s · ×{{ slot.primary_output_quantity }} · {{ machineName(slot.machine_id) }}</div>
            </div>
            <div v-if="slot.id === node.active_slot_id" class="active-dot"></div>
          </div>
          <div v-if="node.slots.length === 0" class="no-data">No recipes yet. Connect an edge to create one.</div>
        </div>

        <!-- Inputs -->
        <div class="section-label">Inputs</div>
        <div class="io-list">
          <div v-for="input in activeInputs" :key="input.id" class="io-row">
            <span class="io-dot" :style="{ background: input.color }"></span>
            <span class="io-name">{{ input.name }}</span>
            <span class="io-qty">×{{ input.quantity }}</span>
          </div>
          <div v-if="activeInputs.length === 0" class="no-data">No inputs</div>
        </div>

        <!-- Byproducts -->
        <div class="section-label">Byproducts</div>
        <div class="io-list">
          <div v-for="bp in activeByproducts" :key="bp.id" class="io-row byproduct">
            <span class="io-dot" :style="{ background: bp.color }"></span>
            <span class="io-name">{{ bp.name }}</span>
            <span class="io-qty">×{{ bp.quantity }}</span>
          </div>
          <div v-if="activeByproducts.length === 0" class="no-data">No byproducts</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useStore } from '../store';
import type { ItemNode } from '../store';

const props = defineProps<{
  visible: boolean;
  node: ItemNode | null;
  position: { x: number; y: number };
}>();

const emit = defineEmits<{
  close: [];
  openDrawer: [];
  switchSlot: [slotId: string];
}>();

const store = useStore();
const cardRef = ref<HTMLDivElement | null>(null);

watch(() => props.visible, (v) => {
  if (v) {
    requestAnimationFrame(() => cardRef.value?.focus());
  }
});

function close() { emit('close'); }
function openDrawer() { emit('openDrawer'); }
function switchSlot(slotId: string) { emit('switchSlot', slotId); }

const iconIsImage = computed(() => props.node?.icon?.startsWith('data:image/') ?? false);

function machineName(machineId: string): string {
  return store.machines.find(m => m.id === machineId)?.name || 'Unknown';
}

const activeInputs = computed(() => {
  const node = props.node;
  if (!node) return [];
  const activeSlotId = node.active_slot_id;
  if (!activeSlotId) return [];
  return store.edges
    .filter(e => e.target === node.id && e.target_slot_id === activeSlotId && e.edge_type === 'input')
    .map(e => {
      const source = store.nodes.find(n => n.id === e.source);
      return {
        id: e.id,
        name: source?.name || 'Unknown',
        color: source?.color || '#64748b',
        quantity: e.quantity,
      };
    });
});

const activeByproducts = computed(() => {
  const node = props.node;
  if (!node) return [];
  const activeSlot = node.slots.find(s => s.id === node.active_slot_id);
  if (!activeSlot) return [];
  return activeSlot.secondary_outputs.map(so => {
    const item = store.nodes.find(n => n.id === so.item_id);
    return {
      id: so.item_id,
      name: item?.name || 'Unknown',
      color: item?.color || '#3b82f6',
      quantity: so.quantity,
    };
  });
});
</script>

<style scoped>
.popover-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  pointer-events: none;
}

.popover-card {
  position: fixed;
  width: 260px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-2xl);
  padding: 16px;
  box-shadow: var(--shadow-card);
  font-family: var(--font-ui), sans-serif;
  transform: translate(-50%, -110%);
  pointer-events: auto;
}

.popover-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 14px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.node-icon {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-hover);
  border-radius: var(--radius-sm);
  font-size: 16px;
  overflow: hidden;
  flex-shrink: 0;
}
.node-icon .icon-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-sm);
}
.node-name {
  font-size: 13px; font-weight: 600; color: var(--text-primary);
}
.node-tags {
  font-size: 9px; color: var(--text-muted);
  font-family: var(--font-mono), monospace;
}
.details-btn {
  font-size: 10px; color: var(--accent-link);
  background: var(--bg-toolbar-btn); border: var(--border-width-sm) solid var(--panel-border);
  border-radius: var(--radius-sm); padding: 4px 8px;
  cursor: pointer; white-space: nowrap;
  font-family: var(--font-ui), sans-serif;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.details-btn:hover { background: var(--bg-toolbar-btn-hover); color: var(--text-primary); }

.section-label {
  font-size: 9px; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.8px;
  font-weight: 600; margin-bottom: 6px; margin-top: 12px;
}
.section-label:first-of-type { margin-top: 0; }

.slot-list { display: flex; flex-direction: column; gap: 5px; max-height: 200px; overflow-y: auto; }

.slot-row {
  padding: 8px 10px;
  background: var(--bg-deep);
  border: var(--border-width-sm) solid var(--panel-border);
  border-radius: var(--radius-sm);
  display: flex; justify-content: space-between; align-items: center;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.slot-row:hover { background: var(--bg-hover); border-color: var(--text-muted); }
.slot-row.active {
  background: var(--bg-input);
  border-color: var(--accent-blue);
}
.slot-row.active .active-dot {
  background: var(--accent-blue);
}
.slot-name { font-size: 11px; color: var(--text-primary); font-weight: 500; }
.slot-meta {
  font-size: 9px; color: var(--text-muted);
  font-family: var(--font-mono), monospace;
  margin-top: 2px;
}
.active-dot {
  width: 6px; height: 6px; border-radius: var(--radius-full);
  background: var(--text-muted); flex-shrink: 0;
}

.io-list { display: flex; flex-direction: column; gap: 3px; max-height: 120px; overflow-y: auto; }
.io-row {
  display: flex; align-items: center; gap: 6px;
  padding: 3px 0; font-size: 10px;
}
.io-dot {
  width: 6px; height: 6px; border-radius: var(--radius-full); flex-shrink: 0;
}
.io-name { color: var(--text-primary); flex: 1; }
.io-qty {
  color: var(--text-muted);
  font-family: var(--font-mono), monospace;
}
.io-row.byproduct .io-name { color: var(--accent-link); }
.io-row.byproduct .io-qty { color: var(--accent-link); }

.no-data {
  font-size: 10px; color: var(--text-disabled); font-style: italic;
}
</style>
