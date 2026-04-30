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
:root {
  --bg-color: #0f1115;
  --bg-grid: #1a1d24;
  --panel-bg: #1c1e26;
  --panel-border: #2a2d35;
  --text-main: #e2e8f0;
  --text-muted: #94a3b8;
  --accent-blue: #3b82f6;
  --accent-orange: #f59e0b;
  --accent-green: #10b981;
  --accent-red: #ef4444;
  
  --font-ui: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

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

/* Base override for Naive UI / Vue Flow to ensure dark theme */
.vue-flow__edge-text {
  font-family: var(--font-mono);
  font-size: 11px;
  fill: var(--text-main);
}
.vue-flow__edge-textbg {
  fill: var(--bg-color);
  rx: 4;
  ry: 4;
}

.vue-flow__minimap {
  background-color: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
}
.vue-flow__minimap-mask {
  fill: rgba(0, 0, 0, 0.6);
}
.vue-flow__minimap-node {
  fill: var(--text-muted);
}
.vue-flow__controls {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5);
  border-radius: 6px;
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
  background-color: #2a2d35;
}
</style>
