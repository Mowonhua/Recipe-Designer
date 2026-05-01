<template>
  <n-drawer
    :show="visible"
    :width="420"
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
          <div class="section-label">Downstream (Consumed by)</div>
          <div v-for="rel in downstream" :key="rel.id" class="relation-row" @click="flyTo(rel.id)">
            <span class="io-dot" :style="{ background: rel.color }"></span>
            <span class="relation-name">{{ rel.name }}<template v-if="rel.type === 'byproduct'"> (byproduct)</template></span>
            <span class="relation-qty">×{{ rel.quantity }}</span>
          </div>
          <div v-if="downstream.length === 0" class="no-data">No downstream consumers</div>

          <div class="section-label" style="margin-top: 16px;">Upstream (Produced by)</div>
          <div v-for="rel in upstream" :key="rel.id" class="relation-row" @click="flyTo(rel.id)">
            <span class="io-dot" :style="{ background: rel.color }"></span>
            <span class="relation-name">{{ rel.name }}<template v-if="rel.type === 'byproduct'"> (byproduct)</template></span>
            <span class="relation-qty">×{{ rel.quantity }}</span>
          </div>
          <div v-if="upstream.length === 0" class="no-data">No upstream producers</div>
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
.form-group {
  margin-bottom: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  position: relative;
}
.form-group label {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  margin-bottom: var(--spacing-xs);
  letter-spacing: 1px;
}
.form-group label::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  background: var(--text-primary);
  margin-right: var(--spacing-sm);
}

.icon-editor {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  background: var(--bg-surface);
  border: var(--border-width-md) solid var(--border-default);
  padding: var(--spacing-sm);
  box-shadow: var(--shadow-node);
}

.icon-preview {
  width: 48px;
  height: 48px;
  min-width: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-input);
  border: var(--border-width-md) solid var(--border-default);
  border-radius: var(--radius-full);
  overflow: hidden;
  box-shadow: var(--shadow-inset-soft);
}

.preview-img { width: 100%; height: 100%; object-fit: cover; }
.preview-text { font-size: 24px; font-weight: 900; }

.icon-input { flex: 1; }

.upload-btn {
  background: var(--accent-blue);
  color: var(--bg-color);
  border: var(--border-width-sm) solid var(--border-default);
  border-radius: var(--radius-sm);
  cursor: pointer;
  padding: 4px 6px;
  display: flex;
  align-items: center;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.upload-btn:hover {
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0px var(--border-default);
}

.clear-btn {
  font-size: 24px;
  color: var(--accent-red);
  min-width: 24px;
  cursor: pointer;
  background: transparent;
  border: none;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
}

.form-row {
  display: flex;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.flex-1 { flex: 1; }
.w-70 { width: 90px; }

.color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(32px, 1fr));
  gap: var(--spacing-sm);
  background: var(--bg-deep);
  border: var(--border-width-md) solid var(--border-default);
  padding: var(--spacing-sm);
  box-shadow: var(--shadow-inset-panel);
}

.color-swatch {
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--radius-full);
  border: var(--border-width-md) solid transparent;
  cursor: pointer;
  transition: transform var(--transition-normal), border-color var(--transition-fast), border-radius var(--transition-slow);
}

.color-swatch:hover {
  transform: scale(1.1);
  border-radius: var(--radius-sm);
}

.color-swatch.selected {
  border-color: var(--border-default);
  border-radius: var(--radius-sm);
  box-shadow: 4px 4px 0px var(--border-default);
}

.tags-wrap {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  align-items: center;
  background: var(--bg-input);
  border: var(--border-width-md) solid var(--border-default);
  padding: var(--spacing-sm);
  min-height: 48px;
}

.tag-pill {
  background: var(--text-primary);
  color: var(--bg-color);
  font-family: var(--font-mono);
  font-weight: 800;
  font-size: 11px;
  text-transform: uppercase;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  border-radius: var(--radius-sm);
}

.tag-pill.small { padding: 2px 6px; font-size: 10px; }
.tag-remove { cursor: pointer; color: var(--accent-red); margin-left: 4px; font-weight: 900;}
.tag-remove:hover { transform: scale(1.2); }

.tag-input-inline, .tag-input-native {
  border: none;
  background: transparent;
  outline: none;
  font-family: var(--font-mono);
  color: var(--text-primary);
  font-weight: 700;
  font-size: 12px;
  width: 90px;
}

.slot-card {
  background: var(--bg-surface);
  border: var(--border-width-md) solid var(--border-default);
  margin-bottom: var(--spacing-xl);
  padding: var(--spacing-md) var(--spacing-md) var(--spacing-md) calc(var(--spacing-md) + 12px);
  position: relative;
  box-shadow: var(--shadow-card);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.slot-card:hover {
  transform: translate(-3px, -3px);
  box-shadow: var(--shadow-modal);
}

.slot-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 12px;
  height: 100%;
  background: var(--accent-blue);
  border-right: var(--border-width-md) solid var(--border-default);
}

.slot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
  border-bottom: var(--border-width-md) dashed var(--border-default);
  padding-bottom: var(--spacing-sm);
}

.slot-status {
  font-family: var(--font-mono);
  font-weight: 900;
  font-size: 13px;
  text-transform: uppercase;
  color: var(--text-muted);
}

.slot-status.active {
  color: var(--text-primary);
  background: var(--accent-green);
  padding: 4px 8px;
  border: var(--border-width-sm) solid var(--border-default);
}

.input-group, .relation-row {
  background: var(--bg-surface);
  border: var(--border-width-md) solid var(--border-default);
  padding: var(--spacing-sm) var(--spacing-md);
  margin-bottom: var(--spacing-sm);
  display: flex;
  gap: 8px;
}
.input-group {
  flex-direction: column;
  align-items: stretch;
  gap: var(--spacing-sm);
}

.group-label, .section-label {
  font-family: var(--font-ui);
  font-size: 18px;
  font-weight: 900;
  color: var(--text-main);
  text-transform: uppercase;
  margin-bottom: var(--spacing-sm);
  border-left: var(--border-width-lg) solid var(--accent-amber);
  padding-left: var(--spacing-sm);
  letter-spacing: -0.5px;
}

.edge-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) 0;
  border-bottom: var(--border-width-sm) dashed var(--border-subtle);
}

.edge-row:last-child {
  border-bottom: none;
}

.edge-source, .relation-name {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: normal;
}

.relation-row {
  cursor: pointer;
  transition: background var(--transition-fast);
}
.relation-row:hover {
  background: var(--bg-hover);
}

.io-dot {
  width: 16px; height: 16px;
  border: var(--border-width-md) solid var(--border-default);
  border-radius: var(--radius-sm);
}

.relation-qty {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 900;
}

.no-data {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  margin: var(--spacing-md) 0;
  padding: var(--spacing-md);
  border: var(--border-width-md) dashed var(--border-default);
  text-align: center;
  font-weight: 800;
}

/* Deep Naive UI Overrides */
:deep(.n-drawer-content) {
  border-left: var(--border-width-lg) solid var(--border-default);
  font-family: var(--font-ui);
}

:deep(.n-drawer-header) {
  background: var(--bg-header);
  border-bottom: var(--border-width-lg) solid var(--border-default);
  position: relative;
  overflow: hidden;
}

:deep(.n-drawer-header__title) {
  font-family: var(--font-mono);
  font-weight: 900;
  text-transform: uppercase;
  font-size: 22px;
  letter-spacing: -1px;
}

:deep(.n-tabs-nav) {
  border-bottom: var(--border-width-md) solid var(--border-default) !important;
  background: transparent;
}

:deep(.n-tabs-nav-scroll-wrapper) {
  padding-inline: var(--spacing-md);
  box-sizing: border-box;
  padding-inline: 12px;
}

:deep(.n-tabs-nav-scroll-content) {
  padding-inline: 0;
}

:deep(.n-tabs-tab) {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 900;
  text-transform: uppercase;
}

:deep(.n-input), :deep(.n-select) {
  border-radius: var(--radius-sm) !important;
  border: var(--border-width-md) solid var(--border-default) !important;
  --n-border: none !important;
  --n-border-focus: none !important;
  --n-border-hover: none !important;
  --n-border-active: none !important;
  --n-box-shadow-focus: none !important;
  box-shadow: var(--shadow-node);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast) !important;
}

:deep(.n-input:hover), :deep(.n-input:focus-within),
:deep(.n-select:hover), :deep(.n-select:focus-within) {
  box-shadow: 4px 4px 0px var(--border-default) !important;
  transform: translate(-2px, -2px);
}

:deep(.n-button) {
  font-family: var(--font-mono);
  text-transform: uppercase;
  font-weight: 900;
  border-radius: var(--radius-sm) !important;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast) !important;
}

:deep(.n-button:hover) {
  transform: translate(-3px, -3px);
}

:deep(.n-button:active) {
  transform: translate(2px, 2px);
}

:deep(.n-drawer) {
  box-shadow: -8px 0px 0px var(--border-default) !important;
  border-radius: var(--radius-sm) !important;
  --n-body-color: var(--panel-bg);
  --n-text-color: var(--text-primary);
  --n-title-text-color: var(--text-primary);
  --n-close-icon-color: var(--text-primary);
  --n-close-icon-color-hover: var(--accent-red);
}

:deep(.n-drawer-container) {
  transition: transform var(--transition-slow) var(--ease-bounce) !important;
}
</style>
