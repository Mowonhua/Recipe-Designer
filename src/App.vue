<template>
  <n-config-provider :theme="darkTheme">
    <n-message-provider>
      <n-notification-provider>
        <n-dialog-provider>
          <Editor />
        </n-dialog-provider>
      </n-notification-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { NMessageProvider, NNotificationProvider, NDialogProvider, NConfigProvider, darkTheme } from 'naive-ui';
import Editor from './components/Editor.vue';
</script>

<style>
html, body, #app {
  margin: 0;
  padding: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: var(--bg-color);
  color: var(--text-main);
  font-family: var(--font-ui);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Vue Flow overrides */
.vue-flow__edge-text {
  font-family: var(--font-mono);
  font-size: 11px;
  fill: var(--text-main);
}
.vue-flow__edge-textbg {
  fill: var(--bg-color);
  rx: var(--radius-sm);
  ry: var(--radius-sm);
}

.vue-flow__minimap {
  background-color: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
}
.vue-flow__minimap-mask {
  fill: rgba(0, 0, 0, 0.6);
}
.vue-flow__minimap-node {
  fill: var(--text-dimmed);
}
.vue-flow__controls {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5);
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--panel-border);
}
.vue-flow__controls-button {
  background-color: var(--panel-bg);
  border-bottom: 1px solid var(--panel-border);
  color: var(--text-main);
  fill: var(--text-main);
}
.vue-flow__controls-button:hover {
  background-color: var(--bg-hover);
}
</style>
