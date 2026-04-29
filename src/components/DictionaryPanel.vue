<template>
  <div class="dictionary-panel">
    <div class="panel-header">Dictionary</div>

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

    <div class="list">
      <!-- Items tab -->
      <template v-if="activeTab === 'items'">
        <div
          v-for="node in store.nodes"
          :key="node.id"
          class="list-item"
          :style="{ '--dot-color': node.color || '#3b82f6' }"
          @dblclick="flyToNode(node.id)"
        >
          <span class="dot" :style="{ background: node.color || '#3b82f6' }"></span>
          <span class="item-name">{{ node.name }}</span>
          <span class="on-canvas-badge">on canvas</span>
        </div>
        <div class="list-item add-item">
          <span class="add-icon">+</span>
          <span class="item-name">New Item</span>
        </div>
      </template>

      <!-- Machines tab -->
      <template v-else>
        <div
          v-for="machine in store.machines"
          :key="machine.id"
          class="list-item"
        >
          <span class="dot" style="background: #64748b;"></span>
          <span class="item-name">{{ machine.name }}</span>
          <span class="speed-badge">x{{ machine.base_speed }}</span>
        </div>
        <div class="list-item add-item">
          <span class="add-icon">+</span>
          <span class="item-name">New Machine</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useStore } from '../store';

const store = useStore();
const activeTab = ref<'items' | 'machines'>('items');

function flyToNode(nodeId: string) {
  const node = store.nodes.find(n => n.id === nodeId);
  if (node) {
    window.dispatchEvent(new CustomEvent('search-fly-to', {
      detail: { x: node.position.x, y: node.position.y },
    }));
  }
}
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
  background: #22242e;
  border-bottom: 1px solid var(--panel-border);
  flex-shrink: 0;
}

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
  transition: color 0.15s, border-color 0.15s;
}
.tab.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

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
  border-radius: 6px;
  color: var(--text-main);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.1s;
}
.list-item:hover {
  background: #2a2d35;
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
  color: #10b981;
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
  cursor: default;
}
.add-item:hover {
  background: transparent;
  opacity: 0.8;
}

.add-icon {
  font-size: 14px;
  font-weight: 300;
}
</style>
