<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="ol-menu"
      :style="{ left: position.x + 'px', top: position.y + 'px' }"
      @click.stop
    >
      <button
        v-for="item in items"
        :key="item.key"
        class="ol-menu-item"
        :class="{ disabled: item.disabled, danger: item.key === 'delete-node' || item.key === 'disconnect-edge' }"
        :disabled="item.disabled"
        @click="!item.disabled && item.action()"
      >
        <span>{{ item.label }}</span>
        <span v-if="item.shortcut" class="ol-menu-shortcut">{{ item.shortcut }}</span>
      </button>
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
/* Component overrides — base styles from overlay.css */
</style>
