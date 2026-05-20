<template>
  <Teleport to="body">
    <div v-if="visible" class="ol-dialog-backdrop" @click.self="onCancel">
      <div class="ol-dialog" @click.stop>
        <div class="ol-dialog-header">{{ title }}</div>
        <div class="ol-dialog-body">
          <input
            ref="inputEl"
            v-model="inputValue"
            class="pd-input"
            :placeholder="placeholder"
            @keyup.enter="onConfirm"
            @keyup.escape="onCancel"
          />
        </div>
        <div class="ol-dialog-actions">
          <button v-if="showCancel" class="ol-btn" @click="onCancel">{{ resolvedCancelText }}</button>
          <button
            class="ol-btn ol-btn-primary"
            :disabled="!inputValue.trim()"
            @click="onConfirm"
          >{{ resolvedConfirmText }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = withDefaults(defineProps<{
  visible: boolean;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}>(), {
  showCancel: true,
  defaultValue: '',
});

const emit = defineEmits<{
  confirm: [value: string];
  cancel: [];
}>();

const inputEl = ref<HTMLInputElement | null>(null);
const inputValue = ref('');

const resolvedConfirmText = computed(() => props.confirmText || t('dialog.ok'));
const resolvedCancelText = computed(() => props.cancelText || t('dialog.cancel'));

watch(() => props.visible, (v) => {
  if (v) {
    inputValue.value = props.defaultValue || '';
    nextTick(() => {
      inputEl.value?.focus();
      inputEl.value?.select();
    });
  }
});

function onConfirm() {
  const trimmed = inputValue.value.trim();
  if (!trimmed) return;
  emit('confirm', trimmed);
}

function onCancel() {
  emit('cancel');
}
</script>

<style scoped>
.pd-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  font-family: var(--font-ui);
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-surface);
  border: var(--border-width-md) solid var(--border-default);
  outline: none;
  transition: border-color var(--transition-fast);
}

.pd-input:focus {
  border-color: var(--accent-blue);
}

.pd-input::placeholder {
  color: var(--text-muted);
}
</style>
