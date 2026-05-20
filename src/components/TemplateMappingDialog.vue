<template>
  <Teleport to="body">
    <n-modal
      :show="visible"
      preset="card"
      title="Instantiate Template"
      style="width: 520px; max-height: 80vh;"
      :mask-closable="false"
      @update:show="onClose"
    >
      <div class="tmd-body">
        <p class="tmd-desc">Map each template placeholder to a canvas item or create a new one.</p>
        <div class="tmd-list">
          <div v-for="item in mapping" :key="item.ref" class="tmd-row">
            <span class="tmd-ref-name">{{ item.display_name }}</span>
            <n-select
              v-model:value="item.target_id"
              :options="itemOptions(item.ref)"
              :placeholder="item.display_name"
              filterable
              style="width: 240px"
            />
          </div>
        </div>
      </div>
      <template #footer>
        <div class="tmd-footer">
          <n-button @click="onClose">Cancel</n-button>
          <n-button type="primary" @click="onConfirm">Instantiate</n-button>
        </div>
      </template>
    </n-modal>

    <!-- Hidden overlay for click-outside close -->
    <div v-if="visible" class="ol-overlay" @click="onClose"></div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { NModal, NSelect, NButton } from 'naive-ui';
import { useStore, type Template } from '../store';
import { v4 as uuidv4 } from 'uuid';
import { saveTemplates } from '../services/file-service';

const props = defineProps<{
  visible: boolean;
  template: Template | null;
  dropPosition: { x: number; y: number };
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const store = useStore();

interface MappingEntry {
  ref: string;
  display_name: string;
  target_id: string; // canvas item ID or '__create_new__'
}

const mapping = ref<MappingEntry[]>([]);

const canvasItemOptions = computed(() => {
  return store.nodes
    .filter(n => store.isNodeOnCanvas(n.id))
    .map(n => ({ label: n.name, value: n.id }));
});

function itemOptions(_ref: string) {
  return [
    { label: '— Create New Item —', value: '__create_new__' },
    ...canvasItemOptions.value,
  ];
}

function initMapping() {
  if (!props.template) {
    mapping.value = [];
    return;
  }
  mapping.value = props.template.nodes.map(tn => ({
    ref: tn.ref,
    display_name: tn.display_name,
    target_id: '__create_new__',
  }));
}

watch(() => props.template, () => {
  if (props.template) initMapping();
}, { immediate: true });

function onClose() {
  emit('update:visible', false);
}

function onConfirm() {
  if (!props.template) return;

  const tpl = props.template;
  const map = new Map<string, string>(); // template ref -> canvas node id
  const createdNodes: { id: string; position: { x: number; y: number } }[] = [];
  const { x: baseX, y: baseY } = props.dropPosition;

  // Phase 1: resolve node mappings
  for (const entry of mapping.value) {
    if (entry.target_id === '__create_new__') {
      // Create new item node on canvas
      const tplNode = tpl.nodes.find(tn => tn.ref === entry.ref);
      if (!tplNode) continue;
      const newNodeId = uuidv4();
      const node = {
        id: newNodeId,
        name: tplNode.display_name,
        color: tplNode.color || undefined,
        tags: [],
        is_raw_material: tplNode.is_raw_material,
        slots: [],
        position: {
          x: baseX + createdNodes.length * 200,
          y: baseY,
        },
      };
      store.addItem(node.name, node.color, node.tags);
      // Update position (addItem places it off-canvas)
      store.placeNodeOnCanvas(newNodeId, node.position);
      store.updateItem(newNodeId, { is_raw_material: tplNode.is_raw_material });

      // Copy slots
      for (const ts of tplNode.slots) {
        const slotId = uuidv4();
        const slot = {
          id: slotId,
          name: ts.name,
          time: ts.time,
          machine_id: '', // will need to be set manually
          tags: [...ts.tags],
          primary_output_quantity: ts.primary_output_quantity,
          secondary_outputs: ts.secondary_outputs.map(so => {
            // For secondary outputs, resolve to existing canvas item by name
            const existingNode = store.nodes.find(n => n.name.toLowerCase() === so.item_ref.toLowerCase());
            return { item_id: existingNode?.id || so.item_ref, quantity: so.quantity };
          }),
          catalyst_mode: ts.catalyst_mode,
          catalyst: ts.catalyst ? {
            item_id: ts.catalyst.item_ref,
            quantity: ts.catalyst.quantity,
            speed_multiplier: ts.catalyst.speed_multiplier,
          } : undefined,
        };
        store.addSlot(newNodeId, slot);
        // Set first slot as active
        store.setActiveSlot(newNodeId, slotId);
        break; // only add one slot per template node (the first one)
      }

      map.set(entry.ref, newNodeId);
      createdNodes.push({ id: newNodeId, position: node.position });
    } else {
      // Map to existing canvas item
      map.set(entry.ref, entry.target_id);
    }
  }

  // Phase 2: create edges
  for (const te of tpl.edges) {
    const sourceId = map.get(te.source_ref);
    const targetId = map.get(te.target_ref);
    if (!sourceId || !targetId) continue;

    // Find target node's first slot (or the specific slot index)
    const targetNode = store.nodes.find(n => n.id === targetId);
    if (!targetNode) continue;

    // Ensure target node has at least one slot
    if (targetNode.slots.length === 0) {
      const slotId = uuidv4();
      const slot = {
        id: slotId,
        name: 'Default',
        time: 1,
        machine_id: '',
        tags: [],
        primary_output_quantity: 1,
        secondary_outputs: [],
        catalyst_mode: 'none' as const,
      };
      store.addSlot(targetId, slot);
      store.setActiveSlot(targetId, slotId);
    }

    const slotIdx = Math.min(te.target_slot_index, targetNode.slots.length - 1);
    const targetSlotId = targetNode.slots[slotIdx]?.id;
    if (!targetSlotId) continue;

    // Check for duplicate edges
    const exists = store.edges.some(
      e => e.source === sourceId && e.target === targetId && e.target_slot_id === targetSlotId
    );
    if (exists) continue;

    const edgeId = uuidv4();
    store.addEdge({
      id: edgeId,
      source: sourceId,
      target: targetId,
      target_slot_id: targetSlotId,
      quantity: te.quantity,
      edge_type: te.edge_type === 'byproduct' ? 'byproduct' : 'input',
    });
  }

  // Save templates after potential modifications
  saveTemplates(store.getTemplates());
  onClose();
}
</script>

<style scoped>
.tmd-body {
  padding: var(--spacing-sm) 0;
}

.tmd-desc {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: var(--spacing-md);
}

.tmd-list {
  max-height: 50vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.tmd-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-surface);
  border: var(--border-width-sm) solid var(--border-default);
}

.tmd-ref-name {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.tmd-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}
</style>
