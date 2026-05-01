<template>
  <Teleport to="body">
    <div v-if="visible" class="ol-dialog-backdrop" @click.self="onCancel">
      <div class="ol-dialog" @click.stop>
        <div class="ol-dialog-header">{{ title }}</div>
        <div class="ol-dialog-body">{{ message }}</div>
        <div class="ol-dialog-actions">
          <button v-if="showCancel" class="ol-btn" @click="onCancel">{{ resolvedCancelText }}</button>
          <button
            class="ol-btn"
            :class="confirmDanger ? 'ol-btn-danger' : 'ol-btn-primary'"
            @click="onConfirm"
          >{{ resolvedConfirmText }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = withDefaults(defineProps<{
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmDanger?: boolean;
  showCancel?: boolean;
}>(), {
  confirmDanger: false,
  showCancel: true,
});

const resolvedConfirmText = computed(() => props.confirmText || t('dialog.ok'));
const resolvedCancelText = computed(() => props.cancelText || t('dialog.cancel'));

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

function onConfirm() { emit('confirm'); }
function onCancel() { emit('cancel'); }
</script>
