<template>
  <n-drawer
    class="rd-drawer"
    :show="visible"
    :width="440"
    placement="right"
    @update:show="onUpdateShow"
  >
    <n-drawer-content :title="drawerTitle" closable>
      <div class="form-group">
        <label>{{ $t('dict.machineName') }}</label>
        <n-input
          v-model:value="form.name"
          size="small"
          :placeholder="$t('dict.machineNamePlaceholder')"
        />
      </div>

      <div class="form-group">
        <label>{{ $t('dict.baseSpeed') }}</label>
        <n-input-number
          v-model:value="form.base_speed"
          size="small"
          :min="0.01"
          :step="0.25"
          @wheel.prevent="(e: WheelEvent) => onNumberWheel(() => form.base_speed, (v) => form.base_speed = v, 0.25, 0.01, e)"
        />
      </div>

      <div class="form-group">
        <label>{{ $t('dict.machineTags') }}</label>
        <n-select
          v-model:value="form.tags"
          :options="machineTagOptions"
          multiple
          tag
          size="small"
        />
      </div>

      <div class="form-group">
        <label>{{ $t('dict.allowedRecipeTags') }}</label>
        <n-select
          v-model:value="form.allowed_recipe_tags"
          :options="allTagOptions"
          multiple
          tag
          size="small"
        />
      </div>

      <!-- Slot Configuration -->
      <div class="section-label">{{ $t('dict.slotConfig') }}</div>

      <!-- Input Slots -->
      <div class="slot-group">
        <div class="group-label">{{ $t('dict.inputSlots') }}</div>
        <div class="slot-list">
          <div
            v-for="slot in inputSlots"
            :key="slot.id"
            class="slot-row"
          >
            <span class="slot-index">#{{ slot.index }}</span>
            <span class="slot-field-label">{{ $t('dict.capacity') }}</span>
            <n-input-number
              v-model:value="slot.capacity"
              size="tiny"
              :min="1"
              style="width: 72px"
              @wheel.prevent="(e: WheelEvent) => onNumberWheel(() => slot.capacity, (v) => slot.capacity = v, 1, 1, e)"
            />
            <span class="slot-field-label">{{ $t('dict.lockedTag') }}</span>
            <n-select
              v-model:value="slot.locked_item_tag"
              :options="allTagOptions"
              size="tiny"
              clearable
              style="width: 110px"
            />
            <span
              class="close-icon slot-delete"
              @click="removeSlot(slot.id)"
            ></span>
          </div>
        </div>
        <button class="add-slot-btn" @click="addSlot('input')">
          + {{ $t('dict.addInputSlot') }}
        </button>
      </div>

      <!-- Output Slots -->
      <div class="slot-group">
        <div class="group-label">{{ $t('dict.outputSlots') }}</div>
        <div class="slot-list">
          <div
            v-for="slot in outputSlots"
            :key="slot.id"
            class="slot-row"
          >
            <span class="slot-index">#{{ slot.index }}</span>
            <button
              :class="['main-output-star', { active: slot.is_main_output }]"
              :title="$t('dict.mainOutput')"
              @click="setMainOutput(slot.id)"
            >&#9733;</button>
            <span class="slot-field-label">{{ $t('dict.capacity') }}</span>
            <n-input-number
              v-model:value="slot.capacity"
              size="tiny"
              :min="1"
              style="width: 72px"
              @wheel.prevent="(e: WheelEvent) => onNumberWheel(() => slot.capacity, (v) => slot.capacity = v, 1, 1, e)"
            />
            <span class="slot-field-label">{{ $t('dict.lockedTag') }}</span>
            <n-select
              v-model:value="slot.locked_item_tag"
              :options="allTagOptions"
              size="tiny"
              clearable
              style="width: 110px"
            />
            <span
              v-if="outputSlots.length > 1"
              class="close-icon slot-delete"
              @click="removeSlot(slot.id)"
            ></span>
          </div>
        </div>
        <button class="add-slot-btn" @click="addSlot('output')">
          + {{ $t('dict.addOutputSlot') }}
        </button>
      </div>

      <!-- Catalyst Slots -->
      <div class="slot-group">
        <div class="group-label">{{ $t('dict.catalystSlots') }}</div>
        <div v-if="catalystSlots.length > 0" class="slot-list">
          <div
            v-for="slot in catalystSlots"
            :key="slot.id"
            class="slot-row"
          >
            <span class="slot-index">#{{ slot.index }}</span>
            <span class="slot-field-label">{{ $t('dict.capacity') }}</span>
            <n-input-number
              v-model:value="slot.capacity"
              size="tiny"
              :min="1"
              style="width: 72px"
              @wheel.prevent="(e: WheelEvent) => onNumberWheel(() => slot.capacity, (v) => slot.capacity = v, 1, 1, e)"
            />
            <span class="slot-field-label">{{ $t('dict.lockedTag') }}</span>
            <n-select
              v-model:value="slot.locked_item_tag"
              :options="allTagOptions"
              size="tiny"
              clearable
              style="width: 110px"
            />
            <span class="close-icon slot-delete" @click="removeSlot(slot.id)"></span>
          </div>
        </div>
        <div v-else class="slot-empty">
          {{ $t('dict.noSlotConfigured') }}
        </div>
        <button class="add-slot-btn" @click="addSlot('catalyst')">
          + {{ $t('dict.addCatalystSlot') }}
        </button>
      </div>

      <!-- Proliferator Slots -->
      <div class="slot-group">
        <div class="group-label">{{ $t('dict.proliferatorSlots') }}</div>
        <div v-if="proliferatorSlots.length > 0" class="slot-list">
          <div
            v-for="slot in proliferatorSlots"
            :key="slot.id"
            class="slot-row"
          >
            <span class="slot-index">#{{ slot.index }}</span>
            <span class="slot-field-label">{{ $t('dict.capacity') }}</span>
            <n-input-number
              v-model:value="slot.capacity"
              size="tiny"
              :min="1"
              style="width: 72px"
              @wheel.prevent="(e: WheelEvent) => onNumberWheel(() => slot.capacity, (v) => slot.capacity = v, 1, 1, e)"
            />
            <span class="slot-field-label">{{ $t('dict.lockedTag') }}</span>
            <n-select
              v-model:value="slot.locked_item_tag"
              :options="allTagOptions"
              size="tiny"
              clearable
              style="width: 110px"
            />
            <span class="close-icon slot-delete" @click="removeSlot(slot.id)"></span>
          </div>
        </div>
        <div v-else class="slot-empty">
          {{ $t('dict.noSlotConfigured') }}
        </div>
        <button class="add-slot-btn" @click="addSlot('proliferator')">
          + {{ $t('dict.addProliferatorSlot') }}
        </button>
      </div>

      <!-- Validation Errors -->
      <div v-if="validationErrors.length > 0" class="validation-errors">
        <div
          v-for="(err, i) in validationErrors"
          :key="i"
          class="validation-error"
        >{{ err.message }}</div>
      </div>

      <!-- Bottom Actions -->
      <div class="drawer-actions">
        <n-button type="primary" size="small" @click="onSave">
          {{ $t('dict.save') }}
        </n-button>
        <n-button
          v-if="isEditMode"
          size="small"
          type="error"
          @click="onDeleteClick"
        >
          {{ $t('dict.deleteMachine') }}
        </n-button>
      </div>
    </n-drawer-content>
  </n-drawer>

  <!-- Confirm Dialog -->
  <ConfirmDialog
    :visible="confirmDialog.show"
    :title="confirmDialog.title"
    :message="confirmDialog.message"
    :confirm-danger="confirmDialog.confirmDanger"
    @confirm="confirmDialog.onConfirm(); closeConfirmDialog()"
    @cancel="closeConfirmDialog"
  />
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue';
import { NDrawer, NDrawerContent, NInput, NInputNumber, NSelect, NButton } from 'naive-ui';
import { v4 as uuidv4 } from 'uuid';
import { useI18n } from 'vue-i18n';
import { useStore } from '../store';
import type { Machine, MachineSlot } from '../store';
import { validateMachineSelf } from '../store/slot-validator';
import type { SlotValidationError } from '../store/slot-validator';
import ConfirmDialog from './ConfirmDialog.vue';
import { onNumberWheel } from '../composables/useWheelNumber';

const { t } = useI18n();
const store = useStore();

// --- Props & Emits ---
const props = defineProps<{
  visible: boolean;
  machine: Machine | null;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  'saved': [machine: Machine];
  'deleted': [machineId: string];
}>();

// --- Drawer title ---
const drawerTitle = computed(() =>
  props.machine ? t('dict.editMachine') : t('dict.addMachine')
);

const isEditMode = computed(() => props.machine !== null);

// --- Local form state ---
// We use a flat reactive object for the machine-level fields and
// a separate reactive array for slots to keep things simple.
const form = reactive({
  name: '',
  base_speed: 1.0,
  tags: [] as string[],
  allowed_recipe_tags: [] as string[],
});

const slots = ref<MachineSlot[]>([]);

// --- Tag options ---
const machineTagOptions = computed(() => {
  const pool = [...store.tag_pool.machine_tags];
  // Ensure currently-selected tags are in the options
  for (const t of form.tags) {
    if (!pool.includes(t) && t.trim()) pool.push(t.trim());
  }
  return pool.map(t => ({ label: t, value: t }));
});

const allTagOptions = computed(() => {
  // Combine recipe_tags and machine_tags as a general tag pool
  const poolSet = new Set([
    ...store.tag_pool.recipe_tags,
    ...store.tag_pool.machine_tags,
  ]);
  for (const t of form.allowed_recipe_tags) {
    if (t.trim()) poolSet.add(t.trim());
  }
  for (const s of slots.value) {
    if (s.locked_item_tag && s.locked_item_tag.trim()) {
      poolSet.add(s.locked_item_tag.trim());
    }
  }
  return Array.from(poolSet).sort().map(t => ({ label: t, value: t }));
});

// --- Slots grouped by type ---
const inputSlots = computed(() =>
  slots.value.filter(s => s.type === 'input').sort((a, b) => a.index - b.index)
);

const outputSlots = computed(() =>
  slots.value.filter(s => s.type === 'output').sort((a, b) => a.index - b.index)
);

const catalystSlots = computed(() =>
  slots.value.filter(s => s.type === 'catalyst').sort((a, b) => a.index - b.index)
);

const proliferatorSlots = computed(() =>
  slots.value.filter(s => s.type === 'proliferator').sort((a, b) => a.index - b.index)
);

// --- Slot manipulation ---
function createSlot(type: MachineSlot['type'], index: number): MachineSlot {
  return {
    id: uuidv4(),
    type,
    index,
    capacity: 100,
    is_main_output: type === 'output' ? false : undefined,
    locked_item_tag: undefined,
  };
}

function addSlot(type: MachineSlot['type']) {
  const sameType = slots.value.filter(s => s.type === type);
  const slot = createSlot(type, sameType.length);
  slots.value.push(slot);
}

function removeSlot(slotId: string) {
  const idx = slots.value.findIndex(s => s.id === slotId);
  if (idx < 0) return;
  const removedType = slots.value[idx].type;
  // Prevent removing the last output slot
  if (removedType === 'output') {
    const outSlots = slots.value.filter(s => s.type === 'output');
    if (outSlots.length <= 1) return;
    const wasMain = slots.value[idx].is_main_output;
    slots.value.splice(idx, 1);
    // Re-number indices
    renumberSlots(removedType);
    // If we removed the main output, assign main to the first output slot
    if (wasMain) {
      const remaining = slots.value.find(s => s.type === 'output');
      if (remaining) remaining.is_main_output = true;
    }
  } else {
    slots.value.splice(idx, 1);
    renumberSlots(removedType);
  }
}

function renumberSlots(type: MachineSlot['type']) {
  let counter = 0;
  for (const s of slots.value) {
    if (s.type === type) {
      s.index = counter++;
    }
  }
}

function setMainOutput(slotId: string) {
  // Set this slot as main output, unset all others
  for (const s of slots.value) {
    if (s.type === 'output') {
      s.is_main_output = s.id === slotId;
    }
  }
}

// --- Confirm dialog ---
const confirmDialog = ref<{
  show: boolean;
  title: string;
  message: string;
  confirmDanger: boolean;
  onConfirm: () => void;
}>({
  show: false,
  title: '',
  message: '',
  confirmDanger: false,
  onConfirm: () => {},
});

function closeConfirmDialog() {
  confirmDialog.value.show = false;
}

// --- Validation ---
const validationErrors = ref<SlotValidationError[]>([]);

// --- Build a Machine object from the current form ---
function buildMachine(): Machine {
  return {
    id: props.machine?.id || uuidv4(),
    name: form.name,
    base_speed: form.base_speed,
    tags: [...form.tags],
    allowed_recipe_tags: [...form.allowed_recipe_tags],
    slots: JSON.parse(JSON.stringify(slots.value)),
  };
}

// --- Save ---
function onSave() {
  validationErrors.value = [];

  // Basic name validation
  if (!form.name.trim()) {
    validationErrors.value.push({
      code: 'FORM',
      message: t('dict.validationNameRequired'),
    });
    return;
  }

  // Basic speed validation
  if (form.base_speed < 0.01) {
    validationErrors.value.push({
      code: 'FORM',
      message: t('dict.validationSpeedMin'),
    });
    return;
  }

  const machine = buildMachine();

  // Run V9/V10 validation
  const errors = validateMachineSelf(machine);
  if (errors.length > 0) {
    validationErrors.value = errors;
    return;
  }

  emit('saved', machine);
  emit('update:visible', false);
}

// --- Delete ---
function onDeleteClick() {
  if (!props.machine) return;
  confirmDialog.value = {
    show: true,
    title: t('dialog.confirm'),
    message: t('dict.deleteMachineConfirm', { name: props.machine.name }),
    confirmDanger: true,
    onConfirm: () => {
      emit('deleted', props.machine!.id);
      emit('update:visible', false);
    },
  };
}

// --- Watch machine prop ---
watch(
  () => props.machine,
  (m) => {
    validationErrors.value = [];
    if (m) {
      // Edit mode
      form.name = m.name;
      form.base_speed = m.base_speed;
      form.tags = [...m.tags];
      form.allowed_recipe_tags = [...m.allowed_recipe_tags];
      slots.value = (m.slots && m.slots.length > 0)
        ? JSON.parse(JSON.stringify(m.slots))
        : [...(store.createDefaultSlots())];
    } else {
      // Create mode
      form.name = '';
      form.base_speed = 1.0;
      form.tags = [];
      form.allowed_recipe_tags = [];
      slots.value = [...(store.createDefaultSlots())];
    }
  },
  { immediate: true },
);

// --- Drawer visibility ---
function onUpdateShow(val: boolean) {
  if (!val) {
    emit('update:visible', false);
  }
}
</script>

<style scoped>
/* ---- Slot configuration group ---- */
.slot-group {
  background: var(--bg-surface);
  border: var(--border-width-md) solid var(--border-default);
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-md);
  box-shadow: var(--shadow-card);
}

.slot-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-sm);
}

.slot-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs);
  border: var(--border-width-sm) solid var(--border-subtle);
  background: var(--bg-input);
  transition: background var(--transition-fast);
}

.slot-row:hover {
  background: var(--bg-hover);
}

.slot-index {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 900;
  color: var(--text-primary);
  min-width: 24px;
  text-align: center;
}

.main-output-star {
  font-size: 16px;
  line-height: 1;
  padding: 0 2px;
  border: var(--border-width-sm) solid var(--border-default);
  background: var(--bg-surface);
  color: var(--text-dimmed);
  cursor: pointer;
  transition: color var(--transition-fast), background var(--transition-fast), transform var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
}

.main-output-star:hover {
  transform: translate(-1px, -1px);
  box-shadow: 2px 2px 0px var(--border-default);
}

.main-output-star.active {
  color: var(--accent-amber);
  background: var(--bg-surface);
  box-shadow: 2px 2px 0px var(--border-default);
}

.slot-field-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
  white-space: nowrap;
}

.slot-delete {
  cursor: pointer;
  font-size: 12px;
  margin-left: auto;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.slot-row:hover .slot-delete {
  opacity: 1;
}

.add-slot-btn {
  display: block;
  width: 100%;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: transparent;
  border: var(--border-width-sm) dashed var(--border-default);
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
}

.add-slot-btn:hover {
  border-color: var(--accent-blue);
  color: var(--text-primary);
  background: var(--bg-hover);
}

.slot-empty {
  padding: var(--spacing-md);
  text-align: center;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  color: var(--text-dimmed);
  text-transform: uppercase;
  border: var(--border-width-sm) dashed var(--border-subtle);
  margin-bottom: var(--spacing-sm);
}

/* ---- Validation errors ---- */
.validation-errors {
  background: var(--accent-red);
  border: var(--border-width-md) solid var(--border-default);
  padding: var(--spacing-sm) var(--spacing-md);
  margin-bottom: var(--spacing-md);
  box-shadow: 4px 4px 0px var(--border-default);
}

.validation-error {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  color: #ffffff;
  padding: var(--spacing-xs) 0;
}

.validation-error + .validation-error {
  border-top: var(--border-width-sm) solid rgba(255, 255, 255, 0.3);
}

/* ---- Bottom actions ---- */
.drawer-actions {
  display: flex;
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-md);
  border-top: var(--border-width-md) solid var(--border-default);
}
</style>
