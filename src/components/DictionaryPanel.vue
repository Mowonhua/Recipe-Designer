<template>
  <div class="dictionary-panel">
    <div class="panel-header">Dictionary</div>

    <!-- Search -->
    <div class="search-box">
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        placeholder="Filter..."
        @keydown.escape="searchQuery = ''"
      />
    </div>

    <!-- Tabs -->
    <div class="tab-row">
      <button
        :class="['tab', { active: activeTab === 'items' }]"
        @click="activeTab = 'items'"
      >Items</button>
      <button
        :class="['tab', { active: activeTab === 'machines' }]"
        @click="activeTab = 'machines'"
      >Machines</button>
    </div>

    <!-- List -->
    <div class="list" @click="closeContextMenu" @scroll="closeContextMenu">
      <!-- Items tab -->
      <template v-if="activeTab === 'items'">
        <div
          v-for="node in filteredItems"
          :key="node.id"
          class="list-item"
          :style="{ '--dot-color': node.color || '#3b82f6' }"
          draggable="true"
          @dragstart="onDragStartItem($event, node.id)"
          @dblclick="flyToNode(node.id)"
          @contextmenu.prevent.stop="openItemContextMenu($event, node)"
        >
          <span class="dot" :style="{ background: node.color || '#3b82f6' }"></span>
          <span class="item-name">{{ node.name }}</span>
          <span v-if="store.isNodeOnCanvas(node.id)" class="on-canvas-badge">on canvas</span>
        </div>

        <!-- Inline new item form -->
        <div v-if="isAddingItem" class="inline-form">
          <input
            ref="newItemInputRef"
            v-model="newItemName"
            type="text"
            class="form-input"
            placeholder="Item name"
            @keydown.enter="createItem"
            @keydown.escape="cancelAddItem"
          />
          <div class="form-actions">
            <button class="form-btn confirm" @click="createItem" :disabled="!newItemName.trim()">Add</button>
            <button class="form-btn cancel" @click="cancelAddItem">Cancel</button>
          </div>
        </div>

        <!-- New Item placeholder -->
        <div
          v-else
          class="list-item add-item"
          @click="startAddItem"
        >
          <span class="add-icon">+</span>
          <span class="item-name">New Item</span>
        </div>
      </template>

      <!-- Machines tab -->
      <template v-else>
        <div
          v-for="machine in filteredMachines"
          :key="machine.id"
          class="list-item"
          @contextmenu.prevent.stop="openMachineContextMenu($event, machine)"
        >
          <span class="dot" style="background: #64748b;"></span>
          <span class="item-name">{{ machine.name }}</span>
          <span class="speed-badge">x{{ machine.base_speed }}</span>
        </div>

        <!-- Inline new machine form -->
        <div v-if="isAddingMachine" class="inline-form">
          <input
            ref="newMachineInputRef"
            v-model="newMachineName"
            type="text"
            class="form-input"
            placeholder="Machine name"
            @keydown.enter="createMachine"
            @keydown.escape="cancelAddMachine"
          />
          <div class="form-row">
            <label class="speed-label">Speed</label>
            <input
              v-model.number="newMachineSpeed"
              type="number"
              class="form-input speed-input"
              min="0.25"
              max="100"
              step="0.25"
              @keydown.enter="createMachine"
            />
          </div>
          <div class="form-actions">
            <button class="form-btn confirm" @click="createMachine" :disabled="!newMachineName.trim()">Add</button>
            <button class="form-btn cancel" @click="cancelAddMachine">Cancel</button>
          </div>
        </div>

        <!-- New Machine placeholder -->
        <div
          v-else
          class="list-item add-item"
          @click="startAddMachine"
        >
          <span class="add-icon">+</span>
          <span class="item-name">New Machine</span>
        </div>
      </template>
    </div>

    <!-- Context Menu -->
    <Teleport to="body">
      <div
        v-if="contextMenu.show"
        class="context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
        @click.stop
      >
        <button class="ctx-item" @click="contextMenuEdit">Edit</button>
        <button class="ctx-item danger" @click="contextMenuDelete">Delete</button>
      </div>
    </Teleport>

    <!-- Overlay to close context menu on any click -->
    <div
      v-if="contextMenu.show"
      class="ctx-overlay"
      @click="closeContextMenu"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { useStore, type ItemNode, type Machine } from '../store';

const store = useStore();

// --- Tabs ---
const activeTab = ref<'items' | 'machines'>('items');

// --- Search ---
const searchQuery = ref('');

const filteredItems = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return store.nodes;
  return store.nodes.filter(n => n.name.toLowerCase().includes(q));
});

const filteredMachines = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return store.machines;
  return store.machines.filter(m => m.name.toLowerCase().includes(q));
});

// --- Item CRUD ---
const isAddingItem = ref(false);
const newItemName = ref('');
const newItemInputRef = ref<HTMLInputElement | null>(null);

function startAddItem() {
  isAddingItem.value = true;
  newItemName.value = '';
  nextTick(() => { newItemInputRef.value?.focus(); });
}

function cancelAddItem() {
  isAddingItem.value = false;
  newItemName.value = '';
}

function createItem() {
  const name = newItemName.value.trim();
  if (!name) return;
  store.addItem(name);
  newItemName.value = '';
  isAddingItem.value = false;
}

function editItemName(nodeId: string) {
  const node = store.nodes.find(n => n.id === nodeId);
  if (!node) return;
  const newName = prompt('Edit item name:', node.name);
  if (newName !== null && newName.trim() !== '' && newName.trim() !== node.name) {
    store.updateItem(nodeId, { name: newName.trim() });
  }
}

function deleteItem(nodeId: string) {
  const node = store.nodes.find(n => n.id === nodeId);
  if (!node) return;
  if (confirm(`Delete "${node.name}"? This will also remove its connections.`)) {
    store.deleteNodes([nodeId]);
  }
}

// --- Machine CRUD ---
const isAddingMachine = ref(false);
const newMachineName = ref('');
const newMachineSpeed = ref(1);
const newMachineInputRef = ref<HTMLInputElement | null>(null);

function startAddMachine() {
  isAddingMachine.value = true;
  newMachineName.value = '';
  newMachineSpeed.value = 1;
  nextTick(() => { newMachineInputRef.value?.focus(); });
}

function cancelAddMachine() {
  isAddingMachine.value = false;
  newMachineName.value = '';
  newMachineSpeed.value = 1;
}

function createMachine() {
  const name = newMachineName.value.trim();
  if (!name) return;
  const speed = Math.max(0.1, newMachineSpeed.value || 1.0);
  store.addMachine({
    id: uuidv4(),
    name,
    base_speed: speed,
    tags: [],
    allowed_recipe_tags: [],
  });
  newMachineName.value = '';
  newMachineSpeed.value = 1;
  isAddingMachine.value = false;
}

function editMachineName(machineId: string) {
  const machine = store.machines.find(m => m.id === machineId);
  if (!machine) return;
  const newName = prompt('Edit machine name:', machine.name);
  if (newName !== null && newName.trim() !== '' && newName.trim() !== machine.name) {
    store.updateMachine(machineId, { name: newName.trim() });
  }
}

function deleteMachineById(machineId: string) {
  const machine = store.machines.find(m => m.id === machineId);
  if (!machine) return;
  if (confirm(`Delete machine "${machine.name}"?`)) {
    store.deleteMachine(machineId);
  }
}

// --- Drag-to-Canvas ---
function onDragStartItem(event: DragEvent, nodeId: string) {
  event.dataTransfer?.setData('text/plain', JSON.stringify({ type: 'dictionary-item', nodeId }));
  event.dataTransfer!.effectAllowed = 'copy';
}

// --- Fly-to (dispatch to Editor) ---
function flyToNode(nodeId: string) {
  if (!store.isNodeOnCanvas(nodeId)) return;
  const node = store.nodes.find(n => n.id === nodeId);
  if (node) {
    window.dispatchEvent(new CustomEvent('search-fly-to', {
      detail: { x: node.position.x, y: node.position.y },
    }));
  }
}

// --- Context Menu ---
const contextMenu = ref<{
  show: boolean;
  x: number;
  y: number;
  type: 'item' | 'machine';
  targetId: string;
}>({
  show: false,
  x: 0,
  y: 0,
  type: 'item',
  targetId: '',
});

function openItemContextMenu(event: MouseEvent, node: ItemNode) {
  const menuWidth = 120;
  const menuHeight = 72;
  contextMenu.value = {
    show: true,
    x: Math.min(event.clientX, window.innerWidth - menuWidth - 8),
    y: Math.min(event.clientY, window.innerHeight - menuHeight - 8),
    type: 'item',
    targetId: node.id,
  };
}

function openMachineContextMenu(event: MouseEvent, machine: Machine) {
  const menuWidth = 120;
  const menuHeight = 72;
  contextMenu.value = {
    show: true,
    x: Math.min(event.clientX, window.innerWidth - menuWidth - 8),
    y: Math.min(event.clientY, window.innerHeight - menuHeight - 8),
    type: 'machine',
    targetId: machine.id,
  };
}

function closeContextMenu() {
  contextMenu.value.show = false;
}

function contextMenuEdit() {
  const { type, targetId } = contextMenu.value;
  closeContextMenu();
  if (type === 'item') {
    editItemName(targetId);
  } else {
    editMachineName(targetId);
  }
}

function contextMenuDelete() {
  const { type, targetId } = contextMenu.value;
  closeContextMenu();
  if (type === 'item') {
    deleteItem(targetId);
  } else {
    deleteMachineById(targetId);
  }
}

// Close context menu on Escape
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && contextMenu.value.show) {
    closeContextMenu();
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown));
onUnmounted(() => window.removeEventListener('keydown', onKeyDown));
</script>

<style scoped>
.dictionary-panel {
  width: 220px;
  height: 100%;
  background: var(--panel-bg);
  border-right: 1px solid var(--panel-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  font-family: var(--font-ui);
}

.panel-header {
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
  background: var(--bg-header);
  border-bottom: 1px solid var(--panel-border);
  flex-shrink: 0;
}

/* --- Search --- */
.search-box {
  padding: 6px 8px;
  flex-shrink: 0;
}

.search-input {
  width: 100%;
  padding: 6px 8px;
  border-radius: var(--radius-md);
  border: var(--border-width-sm) solid var(--panel-border);
  background: var(--bg-input);
  color: var(--text-main);
  font-size: 12px;
  font-family: var(--font-ui);
  outline: none;
  box-sizing: border-box;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
}
.search-input::placeholder {
  color: var(--text-muted);
}
.search-input:focus {
  border-color: var(--accent-blue);
}

/* --- Tabs --- */
.tab-row {
  display: flex;
  border-bottom: 1px solid var(--panel-border);
  flex-shrink: 0;
}

.tab {
  flex: 1;
  padding: 8px;
  text-align: center;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-size: 12px;
  font-family: var(--font-ui);
  cursor: pointer;
  transition: color var(--transition-normal), border-color var(--transition-normal);
}
.tab.active {
  color: var(--accent-blue);
  border-bottom-color: var(--accent-blue);
}

/* --- List --- */
.list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: var(--radius-md);
  color: var(--text-main);
  font-size: 13px;
  cursor: pointer;
  transition: background var(--transition-fast);
  user-select: none;
}
.list-item:hover {
  background: var(--bg-hover);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
}

.item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.on-canvas-badge {
  font-size: 10px;
  color: var(--accent-green);
  flex-shrink: 0;
}

.speed-badge {
  font-size: 10px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  flex-shrink: 0;
}

.add-item {
  color: var(--text-muted);
  opacity: 0.6;
  cursor: pointer;
}
.add-item:hover {
  background: var(--bg-hover);
  opacity: 0.8;
}

.add-icon {
  font-size: 14px;
  font-weight: 300;
}

/* --- Inline Form --- */
.inline-form {
  padding: 8px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  border: var(--border-width-sm) solid var(--panel-border);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  transition: background var(--transition-normal), border-color var(--transition-normal);
}

.form-input {
  width: 100%;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  border: var(--border-width-sm) solid var(--panel-border);
  background: var(--bg-input);
  color: var(--text-main);
  font-size: 12px;
  font-family: var(--font-ui);
  outline: none;
  box-sizing: border-box;
  transition: background var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
}
.form-input::placeholder {
  color: var(--text-muted);
}
.form-input:focus {
  border-color: var(--accent-blue);
}

.speed-input {
  width: 70px;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.speed-label {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.form-actions {
  display: flex;
  gap: 6px;
}

.form-btn {
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: none;
  font-size: 11px;
  font-family: var(--font-ui);
  cursor: pointer;
  transition: opacity var(--transition-fast);
}
.form-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.form-btn.confirm {
  background: var(--accent-blue);
  color: #fff;
}
.form-btn.confirm:hover:not(:disabled) {
  opacity: 0.85;
}

.form-btn.cancel {
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--panel-border);
}
.form-btn.cancel:hover {
  background: var(--bg-hover);
  color: var(--text-main);
}

/* --- Context Menu --- */
.ctx-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
}

.context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 120px;
  background: var(--bg-context);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-lg);
  padding: 4px;
  box-shadow: var(--shadow-menu);
  display: flex;
  flex-direction: column;
}

.ctx-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-main);
  font-size: 12px;
  font-family: var(--font-ui);
  text-align: left;
  cursor: pointer;
}
.ctx-item:hover {
  background: #3a3d48;
}
.ctx-item.danger {
  color: var(--accent-red);
}
.ctx-item.danger:hover {
  background: rgba(239, 68, 68, 0.12);
}
</style>
