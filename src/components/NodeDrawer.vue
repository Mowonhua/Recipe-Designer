<template>
  <n-drawer
    :show="visible"
    :width="340"
    placement="right"
    @update:show="onUpdateShow"
  >
    <n-drawer-content :title="node?.name || 'Node Details'" closable>
      <n-tabs v-model:value="activeTab" type="line" animated>
        <!-- Properties Tab -->
        <n-tab-pane name="properties" tab="Properties">
          <div class="form-group">
            <label>Name</label>
            <n-input v-model:value="editName" size="small" />
          </div>
          <div class="form-group">
            <label>Icon</label>
            <div class="icon-editor">
              <div class="icon-preview">
                <img v-if="isEditIconImage" :src="editIcon" class="preview-img" />
                <span v-else class="preview-text">{{ editIcon || '—' }}</span>
              </div>
              <n-input v-model:value="editIcon" size="small" placeholder="Emoji, text, or image" class="icon-input" />
              <n-button size="tiny" @click="triggerUpload" class="upload-btn" title="Upload image">
                <ImageUp :size="14" />
              </n-button>
              <input
                ref="fileInputEl"
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                hidden
                @change="onIconFileChange"
              />
              <n-button v-if="editIcon" size="tiny" text @click="editIcon = ''" class="clear-btn" title="Clear">×</n-button>
            </div>
          </div>
          <div class="form-group">
            <label>Color</label>
            <div class="color-grid">
              <div
                v-for="c in colorPresets"
                :key="c"
                :class="['color-swatch', { selected: editColor === c }]"
                :style="{ background: c }"
                @click="editColor = c"
              ></div>
            </div>
          </div>
          <div class="form-group">
            <label>Tags</label>
            <div class="tags-wrap">
              <span v-for="(tag, i) in editTags" :key="i" class="tag-pill">
                {{ tag }}
                <span class="tag-remove" @click="removeTag(i)">×</span>
              </span>
              <n-input
                v-model:value="newTag"
                size="tiny"
                placeholder="+ add tag"
                class="tag-input-inline"
                @keydown.enter.prevent="addTag"
              />
            </div>
          </div>
          <div class="form-group">
            <label>Raw Material</label>
            <n-switch v-model:value="editIsRaw" />
          </div>
          <n-button type="primary" size="small" @click="saveProperties" block>
            Save Properties
          </n-button>
        </n-tab-pane>

        <!-- Slots Tab -->
        <n-tab-pane name="slots" tab="Slots">
          <div v-for="slot in (node?.slots || [])" :key="slot.id" class="slot-card">
            <div class="slot-header">
              <span :class="['slot-status', { active: slot.id === node?.active_slot_id }]">
                {{ slot.id === node?.active_slot_id ? '● Active' : '○ Inactive' }}
              </span>
              <n-button text size="tiny" type="error" @click="deleteSlot(slot.id)">Delete</n-button>
            </div>
            <div class="form-row">
              <div class="form-group flex-1">
                <label>Name</label>
                <n-input v-model:value="editSlots[slot.id].name" size="small" />
              </div>
              <div class="form-group w-70">
                <label>Time (s)</label>
                <n-input-number v-model:value="editSlots[slot.id].time" size="small" :min="0.1" :step="0.1" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group flex-1">
                <label>Quantity</label>
                <n-input-number v-model:value="editSlots[slot.id].primary_output_quantity" size="small" :min="1" />
              </div>
              <div class="form-group flex-1">
                <label>Machine</label>
                <n-select
                  v-model:value="editSlots[slot.id].machine_id"
                  :options="machineOptions"
                  size="small"
                />
              </div>
            </div>
            <div class="form-group">
              <label>Tags</label>
              <div class="tags-wrap">
                <span v-for="(tag, i) in (editSlots[slot.id].tags || [])" :key="i" class="tag-pill small">
                  {{ tag }} <span class="tag-remove" @click="removeSlotTag(slot.id, i)">×</span>
                </span>
                <input
                  v-model="slotTagInputs[slot.id]"
                  class="tag-input-native"
                  placeholder="+ add"
                  @keydown.enter.prevent="addSlotTag(slot.id)"
                />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group flex-1">
                <label>Catalyst Mode</label>
                <n-select
                  v-model:value="editSlots[slot.id].catalyst_mode"
                  :options="catalystModeOptions"
                  size="small"
                />
              </div>
            </div>
            <n-button size="tiny" @click="saveSlot(slot.id)">Save Slot</n-button>
          </div>
          <n-button dashed size="small" @click="addNewSlot" block style="margin-top: 8px;">
            + Add Slot
          </n-button>
        </n-tab-pane>

        <!-- Inputs Tab -->
        <n-tab-pane name="inputs" tab="Inputs">
          <div v-for="slot in (node?.slots || [])" :key="'in-' + slot.id" class="input-group">
            <div class="group-label">{{ slot.name }}</div>
            <div v-for="edge in getSlotEdges(slot.id)" :key="edge.id" class="edge-row">
              <span class="edge-source">{{ getNodeName(edge.source) }}</span>
              <n-input-number
                v-model:value="edgeQtys[edge.id]"
                size="tiny"
                :min="1"
                style="width: 80px"
                @update:value="(v: number | null) => updateEdgeQty(edge.id, v || 1)"
              />
              <n-button text size="tiny" type="error" @click="deleteEdgeById(edge.id)">×</n-button>
            </div>
            <div v-if="getSlotEdges(slot.id).length === 0" class="no-data">No input edges</div>
          </div>
        </n-tab-pane>

        <!-- Relations Tab -->
        <n-tab-pane name="relations" tab="Relations">
          <div class="section-label">Upstream (Produced by)</div>
          <div v-for="rel in upstream" :key="rel.id" class="relation-row" @click="flyTo(rel.id)">
            <span class="io-dot" :style="{ background: rel.color }"></span>
            <span class="relation-name">{{ rel.name }}<template v-if="rel.type === 'byproduct'"> (byproduct)</template></span>
            <span class="relation-qty">×{{ rel.quantity }}</span>
          </div>
          <div v-if="upstream.length === 0" class="no-data">No upstream producers</div>

          <div class="section-label" style="margin-top: 16px;">Downstream (Consumed by)</div>
          <div v-for="rel in downstream" :key="rel.id" class="relation-row" @click="flyTo(rel.id)">
            <span class="io-dot" :style="{ background: rel.color }"></span>
            <span class="relation-name">{{ rel.name }}<template v-if="rel.type === 'byproduct'"> (byproduct)</template></span>
            <span class="relation-qty">×{{ rel.quantity }}</span>
          </div>
          <div v-if="downstream.length === 0" class="no-data">No downstream consumers</div>
        </n-tab-pane>
      </n-tabs>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue';
import {
  NDrawer, NDrawerContent, NTabs, NTabPane,
  NInput, NInputNumber, NSwitch, NSelect, NButton,
} from 'naive-ui';
import { ImageUp } from 'lucide-vue-next';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../store';
import type { ItemNode, RecipeSlot, FlowEdge } from '../store';

const props = defineProps<{
  visible: boolean;
  node: ItemNode | null;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const store = useStore();
const activeTab = ref('properties');

// --- Properties editing ---
const editName = ref('');
const editIcon = ref('');
const editColor = ref('#3b82f6');
const editTags = ref<string[]>([]);
const editIsRaw = ref(false);
const newTag = ref('');
const fileInputEl = ref<HTMLInputElement | null>(null);
const isEditIconImage = computed(() => editIcon.value.startsWith('data:image/'));

function triggerUpload() {
  fileInputEl.value?.click();
}

function onIconFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 256 * 1024) {
    alert('Image too large. Please use an image under 256KB.');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    editIcon.value = reader.result as string;
    input.value = '';
  };
  reader.readAsDataURL(file);
}

interface SlotEdit {
  name: string;
  time: number;
  primary_output_quantity: number;
  machine_id: string;
  tags: string[];
  catalyst_mode: 'none' | 'optional' | 'required';
}
const editSlots = reactive<Record<string, SlotEdit>>({});
const slotTagInputs = reactive<Record<string, string>>({});

const colorPresets = ['#f0883e', '#58a6ff', '#3fb950', '#e0555a', '#a371f7', '#e6c34a', '#768390', '#f778ba'];

watch(() => props.node, (n) => {
  // Clear previous node's edit state
  for (const key of Object.keys(editSlots)) { delete editSlots[key]; }
  for (const key of Object.keys(slotTagInputs)) { delete slotTagInputs[key]; }

  if (n) {
    editName.value = n.name;
    editIcon.value = n.icon || '';
    editColor.value = n.color || '#3b82f6';
    editTags.value = [...n.tags];
    editIsRaw.value = n.is_raw_material === true;
    newTag.value = '';
    activeTab.value = 'properties';
  }
}, { immediate: true });

function onUpdateShow(val: boolean) {
  if (!val) emit('update:visible', false);
}

function addTag() {
  const tag = newTag.value.trim();
  if (tag && !editTags.value.includes(tag)) {
    editTags.value.push(tag);
  }
  newTag.value = '';
}
function removeTag(i: number) { editTags.value.splice(i, 1); }

function saveProperties() {
  if (!props.node) return;
  store.updateItem(props.node.id, {
    name: editName.value,
    icon: editIcon.value || undefined,
    color: editColor.value,
    tags: editTags.value,
    is_raw_material: editIsRaw.value ? true : null,
  });
}

// --- Slots editing ---
watch(() => props.node?.slots, (slots) => {
  if (!slots) return;
  for (const s of slots) {
    if (!editSlots[s.id]) {
      editSlots[s.id] = {
        name: s.name,
        time: s.time,
        primary_output_quantity: s.primary_output_quantity,
        machine_id: s.machine_id,
        tags: [...s.tags],
        catalyst_mode: s.catalyst_mode,
      };
      slotTagInputs[s.id] = '';
    }
  }
}, { immediate: true, deep: true });

const machineOptions = computed(() =>
  store.machines.map(m => ({ label: m.name, value: m.id }))
);
const catalystModeOptions = [
  { label: 'None', value: 'none' },
  { label: 'Optional', value: 'optional' },
  { label: 'Required', value: 'required' },
];

function addSlotTag(slotId: string) {
  const tag = slotTagInputs[slotId]?.trim();
  if (tag && editSlots[slotId] && !editSlots[slotId].tags.includes(tag)) {
    editSlots[slotId].tags.push(tag);
  }
  slotTagInputs[slotId] = '';
}
function removeSlotTag(slotId: string, i: number) {
  editSlots[slotId]?.tags.splice(i, 1);
}

function saveSlot(slotId: string) {
  const slot = props.node?.slots.find(s => s.id === slotId);
  if (!slot) return;
  const edits = editSlots[slotId];
  if (!edits) return;
  Object.assign(slot, edits);
  store.changeCounter++;
}

function addNewSlot() {
  if (!props.node) return;
  const slot: RecipeSlot = {
    id: uuidv4(),
    name: 'New Recipe',
    time: 1,
    machine_id: store.machines[0]?.id || '',
    tags: [],
    primary_output_quantity: 1,
    secondary_outputs: [],
    catalyst_mode: 'none',
  };
  store.addSlot(props.node.id, slot);
  if (!props.node.active_slot_id) {
    store.setActiveSlot(props.node.id, slot.id);
  }
}

function deleteSlot(slotId: string) {
  if (!props.node) return;
  if (!confirm('Delete this recipe slot and all its connected edges?')) return;
  store.deleteSlot(props.node.id, slotId);
}

// --- Inputs editing ---
const edgeQtys = reactive<Record<string, number>>({});

watch(() => store.edges, (edges) => {
  for (const e of edges) {
    if (e.target === props.node?.id) {
      edgeQtys[e.id] = e.quantity;
    }
  }
}, { immediate: true });

function getSlotEdges(slotId: string): FlowEdge[] {
  return store.edges.filter(e => e.target === props.node?.id && e.target_slot_id === slotId && e.edge_type === 'input');
}
function getNodeName(nodeId: string): string {
  return store.nodes.find(n => n.id === nodeId)?.name || 'Unknown';
}
function updateEdgeQty(edgeId: string, qty: number) {
  store.updateEdge(edgeId, { quantity: qty });
}
function deleteEdgeById(edgeId: string) {
  store.deleteEdge(edgeId);
}

// --- Relations ---
const upstream = computed(() => {
  if (!props.node) return [];
  return store.edges
    .filter(e => e.target === props.node!.id)
    .map(e => {
      const src = store.nodes.find(n => n.id === e.source);
      return { id: e.source, name: src?.name || '?', color: src?.color || '#64748b', quantity: e.quantity, type: e.edge_type };
    });
});

const downstream = computed(() => {
  if (!props.node) return [];
  return store.edges
    .filter(e => e.source === props.node!.id)
    .map(e => {
      const tgt = store.nodes.find(n => n.id === e.target);
      return { id: e.target, name: tgt?.name || '?', color: tgt?.color || '#64748b', quantity: e.quantity, type: e.edge_type };
    });
});

function flyTo(nodeId: string) {
  const node = store.nodes.find(n => n.id === nodeId);
  if (node) {
    window.dispatchEvent(new CustomEvent('search-fly-to', {
      detail: { x: node.position.x, y: node.position.y },
    }));
  }
}
</script>

<style scoped>
.form-group { margin-bottom: 12px; }
.form-group label {
  display: block;
  font-size: 9px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
  margin-bottom: 4px;
}

.icon-editor {
  display: flex;
  align-items: center;
  gap: 6px;
}
.icon-preview {
  width: 32px; height: 32px;
  min-width: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-input);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.preview-text {
  font-size: 14px;
  line-height: 1;
}
.icon-input {
  flex: 1;
}
.upload-btn {
  min-width: 28px;
  height: 28px;
  padding: 0;
}
.clear-btn {
  font-size: 16px;
  color: var(--text-muted);
  min-width: 20px;
}

.form-row { display: flex; gap: 8px; }
.flex-1 { flex: 1; }
.w-70 { width: 70px; }

.color-grid { display: flex; gap: 4px; flex-wrap: wrap; }
.color-swatch {
  width: 22px; height: 22px; border-radius: var(--radius-md);
  border: 2px solid transparent; cursor: pointer;
  transition: border-color var(--transition-normal);
}
.color-swatch.selected { border-color: var(--text-primary); }
.color-swatch:hover { opacity: 0.8; }

.tags-wrap { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
.tag-pill {
  background: rgba(88,166,255,0.1); color: var(--accent-link);
  border: 1px solid rgba(88,166,255,0.2);
  padding: 3px 8px; border-radius: var(--radius-2xl); font-size: 10px;
  display: flex; align-items: center; gap: 4px;
}
.tag-pill.small { padding: 2px 6px; font-size: 9px; }
.tag-remove { cursor: pointer; opacity: 0.6; }
.tag-remove:hover { opacity: 1; }
.tag-input-inline { width: 80px; }
.tag-input-native {
  background: none; border: 1px dashed var(--border-default); border-radius: var(--radius-xl);
  padding: 2px 8px; font-size: 9px; color: var(--text-muted); outline: none;
  width: 60px;
}

.slot-card {
  background: var(--bg-deep); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg);
  padding: 10px; margin-bottom: 8px;
}
.slot-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 8px;
}
.slot-status { font-size: 10px; color: var(--text-muted); }
.slot-status.active { color: var(--accent-green-bright); }

.input-group { margin-bottom: 12px; }
.group-label {
  font-size: 11px; color: var(--text-primary); font-weight: 500;
  margin-bottom: 4px; padding-bottom: 4px;
  border-bottom: 1px solid var(--border-subtle);
}
.edge-row {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 0; font-size: 10px;
}
.edge-source { flex: 1; color: var(--text-primary); }

.section-label {
  font-size: 10px; color: var(--text-muted); font-weight: 600;
  margin-bottom: 6px;
}
.relation-row {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 0; font-size: 10px; cursor: pointer;
  border-radius: var(--radius-sm); transition: background var(--transition-fast);
}
.relation-row:hover { background: rgba(255,255,255,0.03); }
.relation-name { flex: 1; color: var(--text-primary); }
.relation-qty { color: var(--text-muted); font-family: var(--font-mono), monospace; }
.io-dot { width: 6px; height: 6px; border-radius: var(--radius-full); flex-shrink: 0; }

.no-data {
  font-size: 10px; color: var(--text-disabled); font-style: italic; padding: 8px 0;
}
</style>

<style>
.n-drawer.n-drawer--right .n-drawer-content {
  background: var(--panel-bg) !important;
}
.n-drawer .n-drawer-header {
  background: var(--panel-bg) !important;
  border-bottom-color: var(--panel-border) !important;
}
.n-drawer .n-drawer-body {
  background: var(--panel-bg) !important;
}
.n-drawer .n-tabs .n-tabs-nav {
  background: var(--panel-bg) !important;
}
.n-drawer .n-tabs .n-tabs-bar {
  background: var(--panel-border) !important;
}
</style>
