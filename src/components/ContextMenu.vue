<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="context-menu"
      :style="{ left: position.x + 'px', top: position.y + 'px' }"
      @click.stop
    >
      <div
        v-for="item in items"
        :key="item.key"
        class="context-menu-item"
        :class="{ disabled: item.disabled }"
        @click="!item.disabled && item.action()"
      >
        <span class="menu-label">{{ item.label }}</span>
        <span v-if="item.shortcut" class="menu-shortcut">{{ item.shortcut }}</span>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
export interface ContextMenuItem {
  key: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  action: () => void;
}

defineProps<{
  visible: boolean;
  position: { x: number; y: number };
  items: ContextMenuItem[];
}>();
</script>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 9999;
  background: var(--panel-bg);
  border: var(--border-width-md) solid var(--border-default);
  box-shadow: var(--shadow-menu);
  min-width: 180px;
  padding: 4px 0;
  user-select: none;
}

.context-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.context-menu-item:hover:not(.disabled) {
  background: var(--bg-hover);
}

.context-menu-item.disabled {
  color: var(--text-disabled);
  cursor: default;
}

.menu-shortcut {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  margin-left: 24px;
}
</style>
