<template>
  <n-config-provider :theme="isDarkTheme ? darkTheme : null" :locale="naiveLocale">
    <div :class="['theme-wrapper', isDarkTheme ? 'dark' : 'light']" :data-theme="isDarkTheme ? 'dark' : 'light'">
      <div class="theme-toggle" @click="toggleTheme">
        {{ isDarkTheme ? $t('app.darkMode') : $t('app.lightMode') }}
      </div>
      <n-message-provider>
        <n-notification-provider>
          <n-dialog-provider>
            <Editor />
          </n-dialog-provider>
        </n-notification-provider>
      </n-message-provider>
    </div>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref, watchEffect, provide, computed } from 'vue';
import { NMessageProvider, NNotificationProvider, NDialogProvider, NConfigProvider, darkTheme, zhCN, enUS, dateZhCN, dateEnUS } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import Editor from './components/Editor.vue';

const { locale } = useI18n();
const isDarkTheme = ref(true);

const naiveLocale = computed(() => {
  if (locale.value === 'zh-CN') return zhCN;
  return enUS;
});

const naiveDateLocale = computed(() => {
  if (locale.value === 'zh-CN') return dateZhCN;
  return dateEnUS;
});

const toggleTheme = () => {
  isDarkTheme.value = !isDarkTheme.value;
};

provide('isDarkTheme', isDarkTheme);
provide('toggleTheme', toggleTheme);
provide('naiveLocale', naiveLocale);
provide('naiveDateLocale', naiveDateLocale);

watchEffect(() => {
  if (isDarkTheme.value) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
});
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
  transition: background-color var(--transition-normal), color var(--transition-normal);
}

.theme-wrapper {
  width: 100%;
  height: 100%;
}

.theme-toggle {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 10000;
  padding: 8px 16px;
  background-color: var(--text-primary);
  color: var(--bg-color);
  font-family: var(--font-mono);
  font-weight: bold;
  text-transform: uppercase;
  cursor: pointer;
  border: 2px solid var(--text-primary);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
}
body.drawer-open .theme-toggle {
  transform: translateX(calc(-1 * var(--drawer-width, 420px)));
}
body.bom-panel-open .theme-toggle {
  transform: translateX(-480px);
}
body.drawer-open.bom-panel-open .theme-toggle {
  transform: translateX(calc(-1 * max(var(--drawer-width, 420px), 480px)));
}
.theme-toggle:hover {
  background-color: var(--bg-color);
  color: var(--text-primary);
  box-shadow: 4px 4px 0px var(--text-primary);
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
  border: 2px solid var(--panel-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  box-shadow: var(--shadow-node);
}
.vue-flow__minimap-mask {
  fill: rgba(0, 0, 0, 0.6);
}
.vue-flow__minimap-node {
  fill: var(--text-dimmed);
}
.vue-flow__controls {
  box-shadow: var(--shadow-node);
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 2px solid var(--panel-border);
}
.vue-flow__controls-button {
  background-color: var(--panel-bg);
  border-bottom: 2px solid var(--panel-border);
  color: var(--text-main);
  fill: var(--text-main);
}
.vue-flow__controls-button:hover {
  background-color: var(--bg-hover);
}
</style>
