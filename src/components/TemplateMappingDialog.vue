<template>
  <Teleport to="body">
    <n-modal
      :show="visible"
      preset="card"
      :title="$t('template.instantiateTemplate')"
      style="width: 620px; max-height: 80vh;"
      :mask-closable="false"
      @update:show="onClose"
    >
      <div class="tmd-body">
        <p class="tmd-desc">{{ $t('template.mappingDescription') }}</p>
        <div class="tmd-list">
          <div
            v-for="row in treeRows"
            :key="row.ref"
            class="tmd-row"
          >
            <!-- Tree connector area -->
            <div class="tmd-tree-lines" :style="{ width: row.level * 28 + 'px' }">
              <span
                v-for="(cont, pi) in row.continueVline"
                :key="pi"
                class="tmd-vline"
                :class="{ 'tmd-vline-stop': !cont }"
                :style="{ left: pi * 28 + 11 + 'px' }"
              ></span>
              <!-- horizontal connector -->
              <span
                v-if="row.level > 0"
                class="tmd-hline"
                :style="{ left: (row.level - 1) * 28 + 11 + 'px' }"
              ></span>
            </div>
            <!-- Content -->
            <span class="tmd-ref-name">{{ row.ref }}</span>
            <div class="tmd-row-right">
              <n-select
                v-model:value="getMapping(row.ref).target_id"
                :options="itemOptions()"
                :placeholder="row.ref"
                filterable
                size="small"
                style="width: 170px"
                @update:value="(v: string) => onTargetChange(row.ref, v)"
              />
              <input
                v-if="getMapping(row.ref).target_id === '__create_new__'"
                v-model="getMapping(row.ref).new_item_name"
                class="tmd-name-input"
                :placeholder="$t('template.newItemNamePlaceholder')"
              />
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="tmd-footer">
          <n-button @click="onClose">{{ $t('dialog.cancel') }}</n-button>
          <n-button type="primary" :disabled="!canConfirm" @click="onConfirm">
            {{ $t('template.instantiate') }}
          </n-button>
        </div>
      </template>
    </n-modal>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { NModal, NSelect, NButton } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { useStore, type Template } from '../store';
import { v4 as uuidv4 } from 'uuid';
import { saveTemplates } from '../services/file-service';

const { t } = useI18n();

const props = defineProps<{
  visible: boolean;
  template: Template | null;
  dropPosition: { x: number; y: number };
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
}>();

const store = useStore();

interface MappingEntry {
  ref: string;
  target_id: string;
  new_item_name: string;
}

interface TreeRow {
  ref: string;
  level: number;
  isLast: boolean;
  /** continueVline[i] — vline at ancestor level i should extend full-height through this row */
  continueVline: boolean[];
}

const mapping = ref<MappingEntry[]>([]);
const treeRows = ref<TreeRow[]>([]);

const canvasItemOptions = computed(() => {
  return store.nodes
    .filter(n => store.isNodeOnCanvas(n.id))
    .map(n => ({ label: n.name, value: n.id }));
});

function itemOptions() {
  return [
    { label: `— ${t('template.createNewItem')} —`, value: '__create_new__' },
    ...canvasItemOptions.value,
  ];
}

function getMapping(ref: string): MappingEntry {
  const m = mapping.value.find(e => e.ref === ref);
  if (!m) {
    const entry: MappingEntry = { ref, target_id: '__create_new__', new_item_name: '' };
    mapping.value.push(entry);
    return entry;
  }
  return m;
}

function onTargetChange(ref: string, value: string) {
  const m = getMapping(ref);
  if (value !== '__create_new__') {
    m.new_item_name = '';
  }
}

const canConfirm = computed(() => {
  for (const item of mapping.value) {
    if (item.target_id === '__create_new__' && !item.new_item_name.trim()) {
      return false;
    }
  }
  return true;
});

/** Build tree rows: downstream (consumers) at top, upstream (producers) indented below */
function buildTree() {
  if (!props.template) {
    treeRows.value = [];
    return;
  }

  const tpl = props.template;
  // target_ref -> list of source_refs that produce for it
  const targetToSources = new Map<string, string[]>();
  for (const edge of tpl.edges) {
    const list = targetToSources.get(edge.target_ref) || [];
    list.push(edge.source_ref);
    targetToSources.set(edge.target_ref, list);
  }

  // Nodes that are sources (producers)
  const isSource = new Set(tpl.edges.map(e => e.source_ref));
  // Roots: nodes that are NOT sources (final consumers / leaves)
  const rootRefs = tpl.nodes.filter(n => !isSource.has(n.ref)).map(n => n.ref);

  const roots = rootRefs.length > 0
    ? rootRefs
    : tpl.nodes.map(n => n.ref);

  const visited = new Set<string>();
  const rows: TreeRow[] = [];

  /**
   * Walk children of `ref`.
   * @param parentContinue - continueVline for the parent (which ancestor-level lines
   *   should extend through the parent's subtree)
   * @param parentHadMore - whether the parent has more siblings after it (so the vline
   *   at the parent's level should continue through its children)
   */
  function walk(ref: string, level: number, parentContinue: boolean[]) {
    if (visited.has(ref)) return;
    visited.add(ref);

    const children = targetToSources.get(ref) || [];

    children.forEach((childRef, i) => {
      const hasMoreSiblings = i < children.length - 1;
      // Child's continueVline: inherit parent's ancestor vlines, plus whether
      // the child's own parent-level line should continue (if more siblings after this child)
      const childContinue = [...parentContinue, hasMoreSiblings];

      rows.push({
        ref: childRef,
        level: level + 1,
        isLast: !hasMoreSiblings,
        continueVline: childContinue,
      });
      walk(childRef, level + 1, childContinue);
    });
  }

  roots.forEach((ref, i) => {
    if (!tpl.nodes.some(n => n.ref === ref)) return;
    rows.push({
      ref,
      level: 0,
      isLast: i === roots.length - 1,
      continueVline: [],
    });
    walk(ref, 0, []);
  });

  // Add any unvisited nodes at the end (orphans, disconnected)
  for (const node of tpl.nodes) {
    if (!visited.has(node.ref)) {
      rows.push({
        ref: node.ref,
        level: 0,
        isLast: false,
        continueVline: [],
      });
    }
  }

  treeRows.value = rows;
}

function initMapping() {
  if (!props.template) {
    mapping.value = [];
    return;
  }
  mapping.value = props.template.nodes.map(tn => ({
    ref: tn.ref,
    target_id: '__create_new__',
    new_item_name: '',
  }));
  buildTree();
}

watch(() => props.template, () => {
  if (props.template) initMapping();
}, { immediate: true });

function onClose() {
  emit('update:visible', false);
}

function onConfirm() {
  if (!props.template) return;

  const tpl = props.template;
  const map = new Map<string, string>();
  const createdNodes: { id: string; position: { x: number; y: number } }[] = [];
  const { x: baseX, y: baseY } = props.dropPosition;

  // Phase 1: resolve node mappings
  for (const entry of mapping.value) {
    if (entry.target_id === '__create_new__') {
      const tplNode = tpl.nodes.find(tn => tn.ref === entry.ref);
      if (!tplNode) continue;
      const newItemName = entry.new_item_name.trim();
      if (!newItemName) continue;

      const newNode = store.addItem(newItemName, tplNode.color || undefined);
      const newNodeId = newNode.id;
      store.placeNodeOnCanvas(newNodeId, {
        x: baseX + createdNodes.length * 200,
        y: baseY,
      });
      store.updateItem(newNodeId, { is_raw_material: tplNode.is_raw_material });

      for (const ts of tplNode.slots) {
        const slotId = uuidv4();
        const slot = {
          id: slotId,
          name: ts.name,
          time: ts.time,
          machine_id: '',
          tags: [...ts.tags],
          primary_output_quantity: ts.primary_output_quantity,
          secondary_outputs: ts.secondary_outputs.map(so => {
            const existingNode = store.nodes.find(n => n.name.toLowerCase() === so.item_ref.toLowerCase());
            return { item_id: existingNode?.id || so.item_ref, quantity: so.quantity };
          }),
          catalyst_mode: ts.catalyst_mode,
          catalyst: ts.catalyst ? {
            item_id: ts.catalyst.item_ref,
            quantity: ts.catalyst.quantity,
            speed_multiplier: ts.catalyst.speed_multiplier,
          } : undefined,
        };
        store.addSlot(newNodeId, slot);
        store.setActiveSlot(newNodeId, slotId);
        break;
      }

      map.set(entry.ref, newNodeId);
      createdNodes.push({ id: newNodeId, position: { x: baseX + createdNodes.length * 200, y: baseY } });
    } else {
      map.set(entry.ref, entry.target_id);
    }
  }

  // Phase 2: create edges
  for (const te of tpl.edges) {
    const sourceId = map.get(te.source_ref);
    const targetId = map.get(te.target_ref);
    if (!sourceId || !targetId) continue;

    const targetNode = store.nodes.find(n => n.id === targetId);
    if (!targetNode) continue;

    if (targetNode.slots.length === 0) {
      const slotId = uuidv4();
      const slot = {
        id: slotId,
        name: 'Default',
        time: 1,
        machine_id: '',
        tags: [],
        primary_output_quantity: 1,
        secondary_outputs: [],
        catalyst_mode: 'none' as const,
      };
      store.addSlot(targetId, slot);
      store.setActiveSlot(targetId, slotId);
    }

    const slotIdx = Math.min(te.target_slot_index, targetNode.slots.length - 1);
    const targetSlotId = targetNode.slots[slotIdx]?.id;
    if (!targetSlotId) continue;

    const exists = store.edges.some(
      e => e.source === sourceId && e.target === targetId && e.target_slot_id === targetSlotId
    );
    if (exists) continue;

    const edgeId = uuidv4();
    store.addEdge({
      id: edgeId,
      source: sourceId,
      target: targetId,
      target_slot_id: targetSlotId,
      quantity: te.quantity,
      edge_type: te.edge_type === 'byproduct' ? 'byproduct' : 'input',
    });
  }

  saveTemplates(store.getTemplates());
  onClose();
}
</script>

<style scoped>
.tmd-body {
  padding: var(--spacing-sm) 0;
}

.tmd-desc {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: var(--spacing-md);
}

.tmd-list {
  max-height: 50vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.tmd-row {
  display: flex;
  align-items: center;
  padding: 6px var(--spacing-md);
  min-height: 40px;
  background: var(--bg-surface);
  border-bottom: var(--border-width-sm) solid var(--border-subtle);
}

.tmd-row:hover {
  background: var(--bg-hover);
}

/* ---- Tree connector lines ---- */

.tmd-tree-lines {
  position: relative;
  flex-shrink: 0;
  align-self: stretch;
}

.tmd-vline {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--border-default);
}

/* When vline should NOT continue below this row: stop at 50%, forming └─ corner */
.tmd-vline-stop {
  bottom: 50%;
}

.tmd-hline {
  position: absolute;
  top: 50%;
  width: 16px;
  height: 1px;
  background: var(--border-default);
}

/* ---- Content ---- */

.tmd-ref-name {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  margin-right: var(--spacing-sm);
  flex-shrink: 0;
  width: 50px;
}

.tmd-row-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-left: auto;
}

.tmd-name-input {
  width: 150px;
  box-sizing: border-box;
  padding: 4px 8px;
  font-family: var(--font-ui);
  font-size: 13px;
  color: var(--text-primary);
  background: var(--bg-color);
  border: var(--border-width-sm) solid var(--border-default);
  outline: none;
}

.tmd-name-input:focus {
  border-color: var(--accent-blue);
}

.tmd-name-input::placeholder {
  color: var(--text-muted);
}

.tmd-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}
</style>
