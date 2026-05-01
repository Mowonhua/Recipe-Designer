<template>
  <table class="bom-summary">
    <thead>
      <tr>
        <th class="col-name">{{ $t('bom.tableItem') }}</th>
        <th v-if="mode === 'one-time'" class="col-qty">{{ $t('bom.tableQuantity') }}</th>
        <th v-if="mode === 'continuous'" class="col-rate">{{ $t('bom.tableRateMin') }}</th>
        <th v-if="mode === 'continuous'" class="col-machines">{{ $t('bom.tableMachines') }}</th>
        <th class="col-flags"></th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="row in rows"
        :key="row.itemId"
        class="summary-row"
        :class="{
          'raw-row': row.isRawMaterial,
          'byproduct-row': row.isByproduct,
          'surplus-row': row.isSurplus,
        }"
        @mouseenter="$emit('highlight', row.itemId)"
        @mouseleave="$emit('highlight', null)"
      >
        <td class="col-name">
          <span class="io-dot" :style="{ background: row.itemColor }"></span>
          {{ row.itemName }}
        </td>
        <td v-if="mode === 'one-time'" class="col-qty mono">{{ fmt(row.totalQuantity) }}</td>
        <td v-if="mode === 'continuous'" class="col-rate mono">{{ fmt(row.totalRate) }}</td>
        <td v-if="mode === 'continuous'" class="col-machines mono">{{ fmt(row.totalMachines) }}</td>
        <td class="col-flags">
          <span v-if="row.isRawMaterial" class="tag-pill raw-tag">{{ $t('bom.raw') }}</span>
          <span v-if="row.isByproduct" class="tag-pill bp-tag">{{ $t('bom.bp') }}</span>
          <span v-if="row.isSurplus" class="tag-pill surplus-tag">{{ row.surplusPercent ? $t('bom.surplus', { pct: row.surplusPercent.toFixed(1) }) : '' }}</span>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import type { BomSummaryRow, CalculationMode } from '../bom';

defineProps<{
  rows: BomSummaryRow[];
  mode: CalculationMode;
}>();

defineEmits<{
  highlight: [id: string | null];
}>();

function fmt(v: number | undefined): string {
  if (v === undefined) return '—';
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
}
</script>

<style scoped>
.bom-summary {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

th {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  text-align: left;
  padding: 6px 8px;
  border-bottom: var(--border-width-md) solid var(--border-default);
  color: var(--text-muted);
  letter-spacing: 0.5px;
}

td {
  padding: 5px 8px;
  border-bottom: 1px solid var(--border-subtle);
}

.col-name { width: auto; }
.col-qty, .col-rate, .col-machines { width: 80px; text-align: right; }
.col-flags { width: 90px; }

.mono {
  font-family: var(--font-mono);
  font-weight: 800;
}

.summary-row { cursor: default; transition: background var(--transition-fast); }
.summary-row:hover { background: var(--bg-hover); }

.byproduct-row .col-qty,
.byproduct-row .col-rate { color: var(--accent-tan); }

.surplus-row .col-qty,
.surplus-row .col-rate { color: var(--accent-red); }

.io-dot {
  display: inline-block;
  width: 10px; height: 10px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  margin-right: 6px;
  vertical-align: middle;
}

.tag-pill {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 900;
  padding: 1px 4px;
  margin-right: 2px;
  text-transform: uppercase;
  border-radius: var(--radius-sm);
}

.raw-tag { background: var(--text-muted); color: var(--bg-color); }
.bp-tag { background: var(--accent-tan); color: #fff; }
.surplus-tag { background: var(--accent-red); color: #fff; }
</style>
