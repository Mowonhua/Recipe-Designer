<template>
  <n-drawer
    class="rd-drawer"
    :show="visible"
    :width="420"
    placement="right"
    @update:show="onUpdateShow"
  >
    <n-drawer-content :title="node?.name || $t('drawer.title')" closable>
      <n-tabs v-model:value="activeTab" type="line" animated>
        <!-- Properties Tab -->
        <n-tab-pane name="properties" :tab="$t('drawer.tabProperties')">
          <div class="form-group">
            <label>{{ $t('drawer.name') }}</label>
            <n-input v-model:value="editName" size="small" />
          </div>
          <div class="form-group">
            <label>{{ $t('drawer.icon') }}</label>
            <div class="icon-editor">
              <div class="icon-preview">
                <img v-if="isEditIconImage" :src="editIcon" class="preview-img" />
                <span v-else class="preview-text">{{ editIcon || '—' }}</span>
              </div>
              <n-input v-model:value="editIcon" size="small" :placeholder="$t('drawer.iconPlaceholder')" class="icon-input" />
              <n-button size="tiny" @click="triggerUpload" class="upload-btn" :title="$t('drawer.uploadImage')">
                <ImageUp :size="14" />
              </n-button>
              <input
                ref="fileInputEl"
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                hidden
                @change="onIconFileChange"
              />
              <n-button v-if="editIcon" size="tiny" text @click="editIcon = ''" class="clear-btn" :title="$t('drawer.clear')"><span class="close-icon"></span></n-button>
            </div>
          </div>
          <div class="form-group">
            <label>{{ $t('drawer.color') }}</label>
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
            <label>{{ $t('drawer.tags') }}</label>
            <div class="tags-wrap">
              <span v-for="(tag, i) in editTags" :key="i" class="tag-pill">
                {{ tag }}
                <span class="tag-remove close-icon" @click="removeTag(i)"></span>
              </span>
              <n-input
                v-model:value="newTag"
                size="tiny"
                :placeholder="$t('drawer.addTag')"
                class="tag-input-inline"
                @keydown.enter.prevent="addTag"
              />
            </div>
          </div>
          <div class="form-group">
            <label>{{ $t('drawer.rawMaterial') }}</label>
            <n-switch v-model:value="editIsRaw" />
          </div>
          <n-button type="primary" size="small" @click="saveProperties" block>
            {{ $t('drawer.saveProperties') }}
          </n-button>
        </n-tab-pane>

        <!-- Slots Tab -->
        <n-tab-pane name="slots" :tab="$t('drawer.tabSlots')">
          <div v-for="slot in (node?.slots || [])" :key="slot.id" class="slot-card">
            <div class="slot-header">
              <span :class="['slot-status', { active: slot.id === node?.active_slot_id }]">
                {{ slot.id === node?.active_slot_id ? $t('drawer.active') : $t('drawer.inactive') }}
              </span>
              <n-button text size="tiny" type="error" @click="deleteSlot(slot.id)">{{ $t('drawer.deleteSlot') }}</n-button>
            </div>
            <div class="form-row">
              <div class="form-group flex-1">
                <label>{{ $t('drawer.name') }}</label>
                <n-input v-model:value="editSlots[slot.id].name" size="small" />
              </div>
              <div class="form-group w-70">
                <label>{{ $t('drawer.time') }}</label>
                <n-input-number v-model:value="editSlots[slot.id].time" size="small" :min="0.1" :step="0.1"
                  @wheel.prevent="(e: WheelEvent) => onNumberWheel(() => editSlots[slot.id].time, (v) => editSlots[slot.id].time = v, 0.1, 0.1, e)" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group flex-1">
                <label>{{ $t('drawer.quantity') }}</label>
                <n-input-number v-model:value="editSlots[slot.id].primary_output_quantity" size="small" :min="1"
                  @wheel.prevent="(e: WheelEvent) => onNumberWheel(() => editSlots[slot.id].primary_output_quantity, (v) => editSlots[slot.id].primary_output_quantity = v, 1, 1, e)" />
              </div>
              <div class="form-group flex-1">
                <label>{{ $t('drawer.machine') }}</label>
                <n-select
                  v-model:value="editSlots[slot.id].machine_id"
                  :options="machineOptions"
                  size="small"
                />
                <div v-if="getSlotValidationErrors(slot.id).length > 0" class="slot-warnings">
                  <div v-for="err in getSlotValidationErrors(slot.id)" :key="err.code" class="slot-warn-item">
                    <span class="slot-warn-code">{{ err.code }}</span>
                    {{ err.message }}
                  </div>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label>{{ $t('drawer.tags') }}</label>
              <div class="tags-wrap">
                <span v-for="(tag, i) in (editSlots[slot.id].tags || [])" :key="i" class="tag-pill small">
                  {{ tag }} <span class="tag-remove close-icon" @click="removeSlotTag(slot.id, i)"></span>
                </span>
                <input
                  v-model="slotTagInputs[slot.id]"
                  class="tag-input-native"
                  :placeholder="$t('drawer.addSlotTag')"
                  @keydown.enter.prevent="addSlotTag(slot.id)"
                />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group flex-1">
                <label>{{ $t('drawer.catalystMode') }}</label>
                <n-select
                  v-model:value="editSlots[slot.id].catalyst_mode"
                  :options="catalystModeOptions"
                  size="small"
                />
              </div>
            </div>
            <!-- Catalyst picker (only when mode is not 'none') -->
            <div v-if="editSlots[slot.id].catalyst_mode !== 'none'" class="catalyst-section">
              <div class="form-row">
                <div class="form-group flex-1">
                  <label>{{ $t('drawer.catalystItem') }}</label>
                  <n-select
                    v-model:value="editSlots[slot.id].catalyst_item_id"
                    :options="getCatalystOptions(slot.id)"
                    :placeholder="$t('drawer.catalystSelect')"
                    size="small"
                    clearable
                    filterable
                  />
                </div>
                <div class="form-group w-70">
                  <label>{{ $t('drawer.catalystQuantity') }}</label>
                  <n-input-number v-model:value="editSlots[slot.id].catalyst_quantity" size="small" :min="1"
                    @wheel.prevent="(e: WheelEvent) => onNumberWheel(() => editSlots[slot.id].catalyst_quantity, (v) => editSlots[slot.id].catalyst_quantity = v, 1, 1, e)" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group w-70">
                  <label>{{ $t('drawer.catalystSpeedMultiplier') }}</label>
                  <n-input-number v-model:value="editSlots[slot.id].catalyst_speed_multiplier" size="small" :min="0.1" :step="0.1"
                    @wheel.prevent="(e: WheelEvent) => onNumberWheel(() => editSlots[slot.id].catalyst_speed_multiplier, (v) => editSlots[slot.id].catalyst_speed_multiplier = v, 0.1, 0.1, e)" />
                </div>
              </div>
            </div>
            <!-- Secondary Outputs (byproducts) -->
            <div class="form-group">
              <label>{{ $t('drawer.secondaryOutputs') }}</label>
              <div class="so-list">
                <div v-for="(so, i) in (editSlots[slot.id].secondary_outputs || [])" :key="i" class="so-card">
                  <span class="so-card-name">{{ getNodeName(so.item_id) }}</span>
                  <span class="so-card-divider"></span>
                  <span
                    class="so-card-qty"
                    @click.stop="startEditByproductQty(slot.id, i)"
                    @wheel.prevent="onByproductWheel(slot.id, i, $event)"
                  >
                    <template v-if="editingByproductQty[`${slot.id}:${i}`]">
                      <input
                        :ref="(el: unknown) => setByproductQtyRef(`${slot.id}:${i}`, el as HTMLInputElement | null)"
                        v-model.number="byproductQtyValues[`${slot.id}:${i}`]"
                        class="so-qty-input"
                        type="number"
                        min="1"
                        step="1"
                        @blur="finishEditByproductQty(slot.id, i)"
                        @keydown.enter.prevent="finishEditByproductQty(slot.id, i)"
                        @keydown.escape="cancelEditByproductQty(slot.id, i)"
                        @click.stop
                        @wheel.prevent.stop
                      />
                    </template>
                    <template v-else>
                      {{ so.quantity }}
                    </template>
                  </span>
                  <select
                    v-if="getAvailableOutputSlots(slot.id).length > 0"
                    :value="so.slot_index ?? ''"
                    class="so-slot-index"
                    @change="(e: Event) => setByproductSlotIndex(slot.id, i, (e.target as HTMLSelectElement).value)"
                  >
                    <option value="">{{ $t('drawer.auto') }}</option>
                    <option v-for="opt in getAvailableOutputSlots(slot.id)" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                  <span class="so-card-remove close-icon" @click="removeSecondaryOutput(slot.id, i)"></span>
                </div>
                <div class="so-card so-card-add" :class="{ open: addingByproduct[slot.id] }" @click.stop="startAddByproduct(slot.id)">
                  <span class="so-add-plus">+</span>
                  <span class="so-add-label">{{ $t('drawer.byproductSelect') }}</span>
                </div>
                <!-- Item picker popup -->
                <div v-if="addingByproduct[slot.id]" class="so-picker-wrapper" @click.stop>
                  <div class="so-picker-search">
                    <input
                      ref="byproductSearchInput"
                      v-model="byproductSearch[slot.id]"
                      class="so-picker-input"
                      :placeholder="$t('search.placeholder')"
                      @keydown.escape="cancelAddByproduct(slot.id)"
                    />
                  </div>
                  <div class="so-picker-list">
                    <div
                      v-for="item in filteredByproductOptions(slot.id)"
                      :key="item.value"
                      class="so-picker-item"
                      @click="finishAddByproduct(slot.id, item.value)"
                    >
                      <span class="so-picker-dot" :style="{ background: item.color || '#64748b' }"></span>
                      <span class="so-picker-name">{{ item.label }}</span>
                    </div>
                    <div v-if="filteredByproductOptions(slot.id).length === 0" class="so-picker-empty">
                      {{ $t('search.noResults') }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <n-button size="tiny" @click="saveSlot(slot.id)">{{ $t('drawer.saveSlot') }}</n-button>
          </div>
          <n-button dashed size="small" @click="addNewSlot" block style="margin-top: 8px;">
            {{ $t('drawer.addSlot') }}
          </n-button>
        </n-tab-pane>

        <!-- Inputs Tab -->
        <n-tab-pane name="inputs" :tab="$t('drawer.tabInputs')">
          <div v-for="slot in (node?.slots || [])" :key="'in-' + slot.id" class="input-group">
            <div class="group-label">{{ slot.name }}</div>
            <div v-for="edge in getSlotEdges(slot.id)" :key="edge.id" class="edge-row">
              <span class="edge-source">{{ getNodeName(edge.source) }}</span>
              <n-select
                v-if="getAvailableInputSlots(slot.id).length > 0"
                :value="edgeSlotIndices[edge.id] ?? undefined"
                :options="getAvailableInputSlots(slot.id)"
                size="tiny"
                placeholder="#"
                clearable
                style="width: 64px"
                @update:value="(v: number | null) => setEdgeSlotIndex(edge.id, v ?? undefined)"
              />
              <n-input-number
                v-model:value="edgeQtys[edge.id]"
                size="tiny"
                :min="1"
                style="width: 80px"
                @wheel.prevent="(e: WheelEvent) => onNumberWheel(() => edgeQtys[edge.id], (v) => edgeQtys[edge.id] = v, 1, 1, e)"
                @update:value="(v: number | null) => updateEdgeQty(edge.id, v || 1)"
              />
              <n-button text size="tiny" type="error" @click="deleteEdgeById(edge.id)"><span class="close-icon"></span></n-button>
            </div>
            <div v-if="getSlotEdges(slot.id).length === 0" class="no-data">{{ $t('drawer.noInputEdges') }}</div>
          </div>
        </n-tab-pane>

        <!-- Relations Tab -->
        <n-tab-pane name="relations" :tab="$t('drawer.tabRelations')">
          <div class="section-label">{{ $t('drawer.downstream') }}</div>
          <template v-for="group in downstreamBySlot" :key="group.slotId">
            <div class="group-label" style="margin-top: 8px;">{{ group.slotName }}</div>
            <div v-for="rel in group.items" :key="rel.id" class="relation-row" @click="flyTo(rel.id)">
              <span class="io-dot" :style="{ background: rel.color }"></span>
              <span class="relation-name">{{ rel.name }}<template v-if="rel.type === 'byproduct'"> {{ $t('drawer.byproduct') }}</template><template v-if="rel.type === 'catalyst'"> {{ $t('drawer.catalyst') }}</template></span>
              <span class="relation-qty">×{{ rel.quantity }}</span>
            </div>
          </template>
          <div v-if="downstreamBySlot.length === 0" class="no-data">{{ $t('drawer.noDownstream') }}</div>

          <div class="section-label" style="margin-top: 16px;">{{ $t('drawer.upstream') }}</div>
          <template v-for="group in upstreamBySlot" :key="group.slotId">
            <div class="group-label" style="margin-top: 8px;">{{ group.slotName }}</div>
            <div v-for="rel in group.items" :key="rel.id" class="relation-row" @click="flyTo(rel.id)">
              <span class="io-dot" :style="{ background: rel.color }"></span>
              <span class="relation-name">{{ rel.name }}<template v-if="rel.type === 'byproduct'"> {{ $t('drawer.byproduct') }}</template><template v-if="rel.type === 'catalyst'"> {{ $t('drawer.catalyst') }}</template></span>
              <span class="relation-qty">×{{ rel.quantity }}</span>
            </div>
          </template>
          <div v-if="upstreamBySlot.length === 0" class="no-data">{{ $t('drawer.noUpstream') }}</div>
        </n-tab-pane>
      </n-tabs>
    </n-drawer-content>
  </n-drawer>

  <!-- Confirm Dialog -->
  <ConfirmDialog
    :visible="confirmDialog.show"
    :title="confirmDialog.title"
    :message="confirmDialog.message"
    :show-cancel="confirmDialog.showCancel"
    :confirm-danger="confirmDialog.confirmDanger"
    @confirm="confirmDialog.onConfirm(); closeConfirmDialog()"
    @cancel="closeConfirmDialog"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive, nextTick } from 'vue';
import {
  NDrawer, NDrawerContent, NTabs, NTabPane,
  NInput, NInputNumber, NSwitch, NSelect, NButton,
} from 'naive-ui';
import { ImageUp } from 'lucide-vue-next';
import { v4 as uuidv4 } from 'uuid';
import { useI18n } from 'vue-i18n';
import { useStore } from '../store';
import type { ItemNode, RecipeSlot, FlowEdge } from '../store';
import { validateMachineRecipeMatch, type SlotValidationError } from '../store/slot-validator';
import ConfirmDialog from './ConfirmDialog.vue';
import { onNumberWheel } from '../composables/useWheelNumber';

const { t } = useI18n();

const confirmDialog = ref<{
  show: boolean;
  title: string;
  message: string;
  showCancel: boolean;
  confirmDanger: boolean;
  onConfirm: () => void;
}>({
  show: false,
  title: '',
  message: '',
  showCancel: true,
  confirmDanger: false,
  onConfirm: () => {},
});

function closeConfirmDialog() {
  confirmDialog.value.show = false;
}

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
    confirmDialog.value = {
      show: true,
      title: t('dialog.confirm'),
      message: t('drawer.imageTooLarge'),
      showCancel: false,
      confirmDanger: false,
      onConfirm: () => {},
    };
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
  catalyst_item_id?: string;
  catalyst_quantity: number;
  catalyst_speed_multiplier: number;
  secondary_outputs: { item_id: string; quantity: number; slot_index?: number }[];
}
const editSlots = reactive<Record<string, SlotEdit>>({});
const slotTagInputs = reactive<Record<string, string>>({});
const addingByproduct = reactive<Record<string, boolean>>({});
const byproductSearch = reactive<Record<string, string>>({});
const editingByproductQty = reactive<Record<string, boolean>>({});
const byproductQtyValues = reactive<Record<string, number>>({});
const byproductQtyRefs: Record<string, HTMLInputElement | null> = {};

function setByproductQtyRef(key: string, el: HTMLInputElement | null) {
  byproductQtyRefs[key] = el;
}

// --- Slot validation ---
function getSlotValidationErrors(slotId: string): SlotValidationError[] {
  const slot = props.node?.slots.find(s => s.id === slotId);
  if (!slot || !slot.machine_id) return [];
  const machine = store.machines.find(m => m.id === slot.machine_id);
  if (!machine) return [];
  const inputItems = store.edges
    .filter(e => e.target === props.node?.id && e.target_slot_id === slotId && e.edge_type === 'input')
    .map(e => ({ item_id: e.source, quantity: e.quantity, slot_index: e.slot_index }));
  return validateMachineRecipeMatch(machine, slot, inputItems);
}

// --- Ordered slot_index binding ---
const edgeSlotIndices = reactive<Record<string, number | undefined>>({});

function getAvailableInputSlots(slotId: string) {
  const slot = props.node?.slots.find(s => s.id === slotId);
  if (!slot?.machine_id) return [];
  const machine = store.machines.find(m => m.id === slot.machine_id);
  if (!machine?.slots) return [];
  return machine.slots
    .filter(s => s.type === 'input')
    .sort((a, b) => a.index - b.index)
    .map(s => ({ label: `#${s.index}`, value: s.index }));
}

function setEdgeSlotIndex(edgeId: string, index: number | undefined) {
  edgeSlotIndices[edgeId] = index;
  store.updateEdge(edgeId, { slot_index: index });
}

function getAvailableOutputSlots(slotId: string) {
  const slot = props.node?.slots.find(s => s.id === slotId);
  if (!slot?.machine_id) return [];
  const machine = store.machines.find(m => m.id === slot.machine_id);
  if (!machine?.slots) return [];
  return machine.slots
    .filter(s => s.type === 'output' && !s.is_main_output)
    .sort((a, b) => a.index - b.index)
    .map(s => ({ label: `#${s.index}`, value: s.index }));
}

function setByproductSlotIndex(slotId: string, index: number, value: string) {
  const edits = editSlots[slotId];
  if (!edits) return;
  const so = edits.secondary_outputs?.[index];
  if (!so) return;
  so.slot_index = value ? Number(value) : undefined;
  const slot = props.node?.slots.find(s => s.id === slotId);
  if (slot?.secondary_outputs[index]) {
    slot.secondary_outputs[index].slot_index = value ? Number(value) : undefined;
  }
  store.changeCounter++;
}

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
        catalyst_item_id: s.catalyst?.item_id,
        catalyst_quantity: s.catalyst?.quantity || 1,
        catalyst_speed_multiplier: s.catalyst?.speed_multiplier || 1,
        secondary_outputs: [...s.secondary_outputs],
      };
      slotTagInputs[s.id] = '';
    }
  }
}, { immediate: true, deep: true });

const machineOptions = computed(() =>
  store.machines.map(m => ({ label: m.name, value: m.id }))
);
const catalystModeOptions = computed(() => [
  { label: t('drawer.catalystNone'), value: 'none' as const },
  { label: t('drawer.catalystOptional'), value: 'optional' as const },
  { label: t('drawer.catalystRequired'), value: 'required' as const },
]);

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
  slot.name = edits.name;
  slot.time = edits.time;
  slot.primary_output_quantity = edits.primary_output_quantity;
  slot.machine_id = edits.machine_id;
  slot.tags = edits.tags;
  slot.catalyst_mode = edits.catalyst_mode;
  // Manage catalyst edge: change edge type between 'input' and 'catalyst'
  // First, revert any previous catalyst edge for this slot back to 'input'
  const prevCatalystEdges = store.edges.filter(
    e => e.target === props.node!.id && e.target_slot_id === slotId && e.edge_type === 'catalyst',
  );
  for (const e of prevCatalystEdges) {
    store.updateEdge(e.id, { edge_type: 'input' });
  }
  if (edits.catalyst_mode !== 'none' && edits.catalyst_item_id) {
    slot.catalyst = {
      item_id: edits.catalyst_item_id,
      quantity: edits.catalyst_quantity || 1,
      speed_multiplier: edits.catalyst_speed_multiplier || undefined,
    };
    // Change the matching input edge to catalyst type
    const catalystEdge = store.edges.find(
      e => e.target === props.node!.id && e.target_slot_id === slotId && e.source === edits.catalyst_item_id && e.edge_type === 'input',
    );
    if (catalystEdge) {
      store.updateEdge(catalystEdge.id, { edge_type: 'catalyst' });
    }
  } else {
    slot.catalyst = undefined;
  }
  store.changeCounter++;
}

function addNewSlot() {
  if (!props.node) return;
  const slot: RecipeSlot = {
    id: uuidv4(),
    name: t('drawer.newRecipe'),
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

// --- Catalyst options ---
function getCatalystOptions(slotId: string) {
  if (!props.node) return [];
  const inputEdges = store.edges.filter(
    e => e.target === props.node!.id && e.target_slot_id === slotId && (e.edge_type === 'input' || e.edge_type === 'catalyst'),
  );
  return inputEdges.map(e => {
    const src = store.nodes.find(n => n.id === e.source);
    return { label: src?.name || e.source, value: e.source };
  });
}

// --- Byproduct options ---
function getByproductOptions() {
  if (!props.node) return [];
  return store.nodes
    .filter(n => n.id !== props.node!.id)
    .map(n => ({ label: n.name, value: n.id, color: n.color }));
}

function filteredByproductOptions(slotId: string) {
  const all = getByproductOptions();
  const search = (byproductSearch[slotId] || '').toLowerCase();
  if (!search) return all.slice(0, 50);
  return all.filter(o => o.label.toLowerCase().includes(search)).slice(0, 50);
}

// --- Byproduct add UI ---
function startAddByproduct(slotId: string) {
  if (addingByproduct[slotId]) {
    cancelAddByproduct(slotId);
    return;
  }
  addingByproduct[slotId] = true;
  byproductSearch[slotId] = '';
  nextTick(() => {
    const input = document.querySelector('.so-picker-input') as HTMLInputElement | null;
    input?.focus();
  });
}

function finishAddByproduct(slotId: string, itemId: string) {
  addingByproduct[slotId] = false;
  byproductSearch[slotId] = '';
  if (itemId) {
    addSecondaryOutput(slotId, itemId);
  }
}

function cancelAddByproduct(slotId: string) {
  addingByproduct[slotId] = false;
  byproductSearch[slotId] = '';
}

// --- Byproduct quantity inline editing ---
function startEditByproductQty(slotId: string, index: number) {
  const key = `${slotId}:${index}`;
  const edits = editSlots[slotId];
  if (!edits) return;
  const so = edits.secondary_outputs?.[index];
  if (!so) return;
  byproductQtyValues[key] = so.quantity;
  editingByproductQty[key] = true;
  nextTick(() => {
    const el = byproductQtyRefs[key];
    el?.focus();
    el?.select();
  });
}

function finishEditByproductQty(slotId: string, index: number) {
  const key = `${slotId}:${index}`;
  const edits = editSlots[slotId];
  if (!edits) return;
  const so = edits.secondary_outputs?.[index];
  if (!so) return;
  const newVal = byproductQtyValues[key];
  if (newVal != null && newVal > 0) {
    so.quantity = newVal;
    // Sync to original slot
    const slot = props.node?.slots.find(s => s.id === slotId);
    if (slot?.secondary_outputs[index]) {
      slot.secondary_outputs[index].quantity = newVal;
    }
    // Update byproduct edge quantity
    const byproductEdge = store.edges.find(
      e => e.source === props.node!.id && e.target === so.item_id && e.edge_type === 'byproduct',
    );
    if (byproductEdge) {
      store.updateEdge(byproductEdge.id, { quantity: newVal });
    }
    store.changeCounter++;
  }
  editingByproductQty[key] = false;
  delete byproductQtyValues[key];
}

function cancelEditByproductQty(slotId: string, index: number) {
  const key = `${slotId}:${index}`;
  editingByproductQty[key] = false;
  delete byproductQtyValues[key];
}

function onByproductWheel(slotId: string, index: number, e: WheelEvent) {
  const edits = editSlots[slotId];
  if (!edits) return;
  const so = edits.secondary_outputs?.[index];
  if (!so) return;
  const delta = e.deltaY < 0 ? 1 : -1;
  const newVal = Math.max(1, so.quantity + delta);
  so.quantity = Math.round(newVal);
  // Sync to original slot
  const slot = props.node?.slots.find(s => s.id === slotId);
  if (slot?.secondary_outputs[index]) {
    slot.secondary_outputs[index].quantity = so.quantity;
  }
  // Update byproduct edge quantity
  const byproductEdge = store.edges.find(
    e => e.source === props.node!.id && e.target === so.item_id && e.edge_type === 'byproduct',
  );
  if (byproductEdge) {
    store.updateEdge(byproductEdge.id, { quantity: so.quantity });
  }
  store.changeCounter++;
}

// --- Secondary output management ---
function addSecondaryOutput(slotId: string, itemId: string | null) {
  if (!props.node || !itemId) return;
  const slot = props.node.slots.find(s => s.id === slotId);
  if (!slot) return;
  if (slot.secondary_outputs.some(so => so.item_id === itemId)) return;
  slot.secondary_outputs.push({ item_id: itemId, quantity: 1 });
  const targetNode = store.nodes.find(n => n.id === itemId);
  if (targetNode) {
    const targetSlotId = targetNode.active_slot_id || targetNode.slots[0]?.id;
    const newEdge = {
      id: uuidv4(),
      source: props.node.id,
      target: itemId,
      target_slot_id: targetSlotId || '',
      quantity: 1,
      edge_type: 'byproduct' as const,
    };
    store.addEdge(newEdge);
  }
  if (editSlots[slotId]) {
    editSlots[slotId].secondary_outputs = [...slot.secondary_outputs];
  }
  store.changeCounter++;
}

function removeSecondaryOutput(slotId: string, index: number) {
  if (!props.node) return;
  const slot = props.node.slots.find(s => s.id === slotId);
  if (!slot) return;
  const removed = slot.secondary_outputs[index];
  if (!removed) return;
  slot.secondary_outputs.splice(index, 1);
  const byproductEdge = store.edges.find(
    e => e.source === props.node!.id && e.target === removed.item_id && e.edge_type === 'byproduct',
  );
  if (byproductEdge) {
    store.deleteEdge(byproductEdge.id);
  }
  if (editSlots[slotId]) {
    editSlots[slotId].secondary_outputs = [...slot.secondary_outputs];
  }
  store.changeCounter++;
}

function deleteSlot(slotId: string) {
  if (!props.node) return;
  confirmDialog.value = {
    show: true,
    title: t('dialog.confirm'),
    message: t('drawer.deleteSlotConfirm'),
    showCancel: true,
    confirmDanger: true,
    onConfirm: () => { store.deleteSlot(props.node!.id, slotId); },
  };
}

// --- Inputs editing ---
const edgeQtys = reactive<Record<string, number>>({});

function syncEdgeQtys() {
  Object.keys(edgeQtys).forEach(k => delete edgeQtys[k]);
  Object.keys(edgeSlotIndices).forEach(k => delete edgeSlotIndices[k]);
  if (!props.node) return;
  for (const e of store.edges) {
    if (e.target === props.node.id) {
      edgeQtys[e.id] = e.quantity;
      if (e.slot_index !== undefined) {
        edgeSlotIndices[e.id] = e.slot_index;
      }
    }
  }
}

watch(() => props.node?.id, () => syncEdgeQtys(), { immediate: true });
watch(
  () => store.edges.map(e => `${e.id}:${e.quantity},${e.target}`).join('|'),
  () => syncEdgeQtys()
);

function getSlotEdges(slotId: string): FlowEdge[] {
  return store.edges.filter(e => e.target === props.node?.id && e.target_slot_id === slotId && e.edge_type === 'input');
}
function getNodeName(nodeId: string): string {
  return store.nodes.find(n => n.id === nodeId)?.name || t('drawer.unknown');
}
function updateEdgeQty(edgeId: string, qty: number) {
  store.updateEdge(edgeId, { quantity: qty });
}
function deleteEdgeById(edgeId: string) {
  store.deleteEdge(edgeId);
}

// --- Relations ---
interface RelationItem {
  id: string;
  name: string;
  color: string;
  quantity: number;
  type: 'input' | 'byproduct' | 'catalyst';
}

interface SlotGroup {
  slotId: string;
  slotName: string;
  items: RelationItem[];
}

const upstreamBySlot = computed(() => {
  if (!props.node) return [];
  const edges = store.edges.filter(e => e.target === props.node!.id);
  const slotMap = new Map<string, RelationItem[]>();
  const slotOrder: string[] = [];
  for (const slot of props.node.slots) {
    slotMap.set(slot.id, []);
    slotOrder.push(slot.id);
  }
  const unknownKey = '__unknown__';
  slotMap.set(unknownKey, []);

  for (const edge of edges) {
    const src = store.nodes.find(n => n.id === edge.source);
    const item: RelationItem = {
      id: edge.source,
      name: src?.name || '?',
      color: src?.color || '#64748b',
      quantity: edge.quantity,
      type: edge.edge_type,
    };
    const slotId = edge.target_slot_id;
    if (slotMap.has(slotId)) {
      slotMap.get(slotId)!.push(item);
    } else {
      slotMap.get(unknownKey)!.push(item);
    }
  }

  const result: SlotGroup[] = [];
  for (const sid of slotOrder) {
    const items = slotMap.get(sid)!;
    if (items.length > 0) {
      result.push({ slotId: sid, slotName: props.node.slots.find(s => s.id === sid)?.name || '?', items });
    }
  }
  if (slotMap.get(unknownKey)!.length > 0) {
    result.push({ slotId: unknownKey, slotName: '?', items: slotMap.get(unknownKey)! });
  }
  return result;
});

const downstreamBySlot = computed(() => {
  if (!props.node) return [];
  const edges = store.edges.filter(e => e.source === props.node!.id);
  const slotMap = new Map<string, RelationItem[]>();
  const slotOrder: string[] = [];
  for (const slot of props.node.slots) {
    slotMap.set(slot.id, []);
    slotOrder.push(slot.id);
  }
  const unknownKey = '__unknown__';
  slotMap.set(unknownKey, []);

  for (const edge of edges) {
    const tgt = store.nodes.find(n => n.id === edge.target);
    const item: RelationItem = {
      id: edge.target,
      name: tgt?.name || '?',
      color: tgt?.color || '#64748b',
      quantity: edge.quantity,
      type: edge.edge_type,
    };
    let foundSlot: string | null = null;
    for (const slot of props.node.slots) {
      if (slot.secondary_outputs.some(so => so.item_id === edge.target)) {
        foundSlot = slot.id;
        break;
      }
    }
    if (foundSlot && slotMap.has(foundSlot)) {
      slotMap.get(foundSlot)!.push(item);
    } else {
      const activeId = props.node.active_slot_id || props.node.slots[0]?.id;
      if (activeId && slotMap.has(activeId)) {
        slotMap.get(activeId)!.push(item);
      } else {
        slotMap.get(unknownKey)!.push(item);
      }
    }
  }

  const result: SlotGroup[] = [];
  for (const sid of slotOrder) {
    const items = slotMap.get(sid)!;
    if (items.length > 0) {
      result.push({ slotId: sid, slotName: props.node.slots.find(s => s.id === sid)?.name || '?', items });
    }
  }
  if (slotMap.get(unknownKey)!.length > 0) {
    result.push({ slotId: unknownKey, slotName: '?', items: slotMap.get(unknownKey)! });
  }
  return result;
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
/* ---- Color grid ---- */
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

/* ---- Tags ---- */
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

.tag-remove { cursor: pointer; margin-left: 4px; font-size: 12px; }
.tag-remove:hover { transform: scale(1.2); }

.tag-input-inline,
.tag-input-native {
  border: none;
  background: transparent;
  outline: none;
  font-family: var(--font-mono);
  color: var(--text-primary);
  font-weight: 700;
  font-size: 12px;
  width: 90px;
}

/* ---- Icon editor ---- */
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
  font-size: 14px;
  color: var(--accent-red);
  min-width: 24px;
  cursor: pointer;
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ---- Slot cards ---- */
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
  top: 0;
  left: 0;
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
  color: var(--accent-green-bright);
  padding: 4px 8px;
}

/* ---- Edge rows ---- */
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

.edge-source {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: normal;
}

/* ---- Input groups ---- */
.input-group {
  background: var(--bg-surface);
  border: var(--border-width-md) solid var(--border-default);
  padding: var(--spacing-sm) var(--spacing-md);
  margin-bottom: var(--spacing-sm);
  flex-direction: column;
  align-items: stretch;
  gap: var(--spacing-sm);
  display: flex;
}

/* ---- Relation rows ---- */
.relation-row {
  background: var(--bg-surface);
  border: var(--border-width-md) solid var(--border-default);
  padding: var(--spacing-sm) var(--spacing-md);
  margin-bottom: var(--spacing-sm);
  display: flex;
  gap: 8px;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.relation-row:hover {
  background: var(--bg-hover);
}

.relation-name {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: normal;
}

.relation-qty {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 900;
}

.io-dot {
  width: 16px;
  height: 16px;
  border: var(--border-width-md) solid var(--border-default);
  border-radius: var(--radius-sm);
}

/* ---- Empty state ---- */
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

/* ---- Slot validation warnings ---- */
.slot-warnings {
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm);
  border: var(--border-width-md) solid var(--accent-amber);
  background: color-mix(in srgb, var(--accent-amber) 10%, var(--bg-surface));
}

.slot-warn-item {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  color: var(--text-primary);
  padding: 2px 0;
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.slot-warn-code {
  background: var(--accent-amber);
  color: var(--bg-color);
  font-weight: 900;
  padding: 0 4px;
  font-size: 10px;
  flex-shrink: 0;
}

/* ---- Byproduct slot index ---- */
.so-slot-index {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  background: var(--bg-input);
  color: var(--text-primary);
  border: var(--border-width-md) solid var(--border-default);
  padding: 0 4px;
  height: 24px;
  cursor: pointer;
  flex-shrink: 0;
}
</style>