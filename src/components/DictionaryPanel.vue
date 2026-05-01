<template>
  <aside class="dictionary-panel">
    <header class="panel-header">Dictionary</header>

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
    <nav class="tab-row">
      <button
        :class="['tab', { active: activeTab === 'items' }]"
        @click="activeTab = 'items'"
      >Items</button>
      <button
        :class="['tab', { active: activeTab === 'machines' }]"
        @click="activeTab = 'machines'"
      >Machines</button>
    </nav>

    <!-- List -->
    <section class="list" @click="closeContextMenu" @scroll="closeContextMenu">
      <!-- Items tab -->
      <template v-if="activeTab === 'items'">
        <div
          v-for="node in filteredItems"
          :key="node.id"
          class="list-item"
          :style="{ '--dot-color': node.color || 'var(--accent-blue)' }"
          draggable="true"
          @dragstart="onDragStartItem($event, node.id)"
          @dblclick="flyToNode(node.id)"
          @contextmenu.prevent.stop="openItemContextMenu($event, node)"
        >
          <span class="dot" :style="{ background: node.color || 'var(--accent-blue)' }"></span>
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
          <span class="dot machine-dot"></span>
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
    </section>

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
  </aside>
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
  display: flex;
  flex-direction: column;
  width: 260px;
  background: var(--panel-bg);
  border-right: var(--border-width-lg) solid var(--panel-border);
  height: 100%;
  font-family: var(--font-ui);
  position: relative;
  z-index: 10;
}

.panel-header {
  padding: var(--spacing-lg) var(--spacing-md);
  font-size: 24px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.5px;
  background: var(--bg-color);
  color: var(--text-primary);
  border-bottom: var(--border-width-lg) solid var(--border-default);
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.search-box {
  padding: var(--spacing-md);
  border-bottom: var(--border-width-md) solid var(--border-default);
  background: var(--bg-surface);
  position: relative;
  box-sizing: border-box;
}

.search-box::after {
  content: '';
  position: absolute;
  bottom: 0;
  right: 0;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 0 0 16px 16px;
  border-color: transparent transparent var(--border-default) transparent;
}

.search-input {
  width: 100%;
  padding: var(--spacing-md);
  background: var(--bg-input);
  border: var(--border-width-md) solid var(--border-default);
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-weight: 800;
  font-size: 14px;
  outline: none;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-card);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  box-sizing: border-box;
}

.search-input:focus {
  transform: none;
  box-shadow: inset 0 0 0 2px var(--accent-amber), var(--shadow-card);
}

.tab-row {
  display: flex;
  background: var(--bg-deep);
  border-bottom: var(--border-width-md) solid var(--border-default);
}

.tab {
  flex: 1;
  padding: var(--spacing-md) var(--spacing-sm);
  background: transparent;
  border: none;
  border-right: var(--border-width-md) solid var(--border-default);
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-weight: 800;
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 2px;
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
  z-index: 0;
}

.tab:last-child {
  border-right: none;
}

.tab::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 0;
  background: var(--text-primary);
  transition: height var(--transition-normal) var(--ease-bounce);
  z-index: -1;
}

.tab.active {
  color: var(--bg-color);
  background: var(--text-primary);
}

.tab.active::before {
  height: 0;
}

.tab:hover:not(.active) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.list {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
  background: var(--bg-color);
}

.list-item {
  display: flex;
  align-items: center;
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  background: var(--panel-bg);
  border: var(--border-width-md) solid var(--border-default);
  border-radius: var(--radius-sm);
  cursor: pointer;
  box-shadow: var(--shadow-node);
  transition: transform var(--transition-fast) var(--ease-smooth), box-shadow var(--transition-fast), background var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.list-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--accent-blue);
  mix-blend-mode: multiply;
  opacity: 0;
  transition: opacity var(--transition-fast);
  pointer-events: none;
}

.list-item:hover {
  transform: translate(-4px, -4px);
  box-shadow: var(--shadow-node-hover);
  background: var(--bg-hover);
}

.list-item:hover::before {
  opacity: 0.05;
}

.dot {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-right: var(--spacing-md);
  border: var(--border-width-md) solid var(--border-default);
  background: var(--dot-color, var(--text-primary));
  border-radius: var(--radius-sm);
  transition: border-radius var(--transition-slow);
}

.machine-dot {
  background: var(--text-dimmed);
}

.list-item:nth-child(even) .dot {
  border-radius: var(--radius-full);
}

.item-name {
  flex: 1;
  font-family: var(--font-ui);
  font-weight: 800;
  font-size: 13px;
  color: var(--text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.on-canvas-badge {
  font-size: 10px;
  text-transform: uppercase;
  font-family: var(--font-mono);
  background: var(--text-primary);
  color: var(--bg-color);
  border: var(--border-width-sm) solid var(--border-default);
  padding: 4px 6px;
  font-weight: 700;
}

.speed-badge {
  font-size: 12px;
  font-family: var(--font-mono);
  font-weight: 800;
  background: var(--accent-amber);
  color: var(--text-primary);
  border: var(--border-width-sm) solid var(--border-default);
  padding: 4px 6px;
  box-shadow: var(--shadow-node);
}

.add-item {
  justify-content: center;
  border-style: dashed;
  background: transparent;
  color: var(--text-muted);
}

.add-item:hover {
  background: var(--bg-surface);
  border-style: solid;
  color: var(--text-primary);
}

.add-icon {
  font-size: 20px;
  font-weight: 900;
  margin-right: var(--spacing-sm);
}

.inline-form {
  background: var(--bg-context);
  border: var(--border-width-md) solid var(--border-default);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.form-input {
  padding: var(--spacing-sm);
  border: var(--border-width-sm) solid var(--border-default);
  background: var(--bg-input);
  color: var(--text-primary);
  font-family: var(--font-ui);
  outline: none;
  font-weight: 700;
}

.form-input:focus {
  box-shadow: 4px 4px 0px var(--border-default);
}

.form-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.speed-label {
  font-size: 12px;
  font-family: var(--font-mono);
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-primary);
}

.speed-input {
  width: 70px;
}

.form-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-xs);
}

.form-btn {
  flex: 1;
  padding: var(--spacing-xs);
  font-family: var(--font-mono);
  font-size: 12px;
  text-transform: uppercase;
  font-weight: 900;
  cursor: pointer;
  border: var(--border-width-sm) solid var(--border-default);
  transition: all var(--transition-fast);
}

.form-btn.confirm {
  background: var(--accent-blue);
  color: var(--bg-color); /* use inverted scheme */
  border-color: var(--border-default);
  box-shadow: 2px 2px 0px var(--border-default);
}

.form-btn.confirm:hover:not(:disabled) {
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0px var(--border-default);
}

.form-btn.confirm:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}

.form-btn.confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.form-btn.cancel {
  background: var(--bg-surface);
  color: var(--text-primary);
  box-shadow: 2px 2px 0px var(--border-default);
}

.form-btn.cancel:hover {
  background: var(--bg-hover);
  transform: translate(-2px, -2px);
  box-shadow: 4px 4px 0px var(--border-default);
}

.context-menu {
  position: fixed;
  background: var(--panel-bg);
  border: var(--border-width-md) solid var(--border-default);
  box-shadow: var(--shadow-modal);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  min-width: 140px;
}

.ctx-item {
  padding: var(--spacing-md) var(--spacing-lg);
  text-align: left;
  background: none;
  border: none;
  font-family: var(--font-mono);
  font-weight: 800;
  font-size: 12px;
  text-transform: uppercase;
  color: var(--text-primary);
  cursor: pointer;
  border-bottom: var(--border-width-sm) solid var(--border-default);
  transition: all var(--transition-fast);
}

.ctx-item:last-child {
  border-bottom: none;
}

.ctx-item:hover {
  background: var(--bg-hover);
  padding-left: calc(var(--spacing-lg) + 6px);
}

.ctx-item.danger {
  color: var(--accent-red);
}

.ctx-item.danger:hover {
  background: var(--accent-red);
  color: var(--bg-color); /* invert */
}

.ctx-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 9998;
}
</style>
