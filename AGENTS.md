# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Build & Development

```bash
npm run dev          # Start Vite dev server (port 1420)
npm run build        # Type-check with vue-tsc, then Vite production build
npm run tauri        # Run Tauri CLI (e.g., `npm run tauri dev` for full desktop app)
```

Tauri coordinates with Vite automatically — `tauri dev` starts the Vite dev server before launching the desktop window. The Vite dev server MUST run on port 1420 (strictPort is set).

## Architecture

**Tauri v2 desktop app** — Vue 3 frontend with a Rust backend shell. All meaningful logic lives in the frontend.

**Frontend stack:** Vue 3 (Composition API / `<script setup>`) + TypeScript + Pinia + Naive UI + Vue Flow + d3-force.

### State management (`src/store/index.ts`)

All application state is in a single Pinia store (`recipe-designer`). The data model:

- **`ItemNode`** — primary entity representing an item with multiple production `RecipeSlot`s. Nodes have graph positions. Each node references which slot is active (`active_slot_id`).
- **`RecipeSlot`** — how an item is produced: time, which `Machine`, tags, primary/secondary outputs, catalyst config.
- **`Machine`** — production facility with base speed, tags, and allowed recipe tags.
- **`GlobalEffect`** — multipliers on yield or speed from skills/treasure/research, filtered by target tags.
- **`FlowEdge`** — connects nodes, represents item flow with quantity. Edges are slot-specific (`target_slot_id`). Three types: `'input'` (solid gray), `'byproduct'` (dashed tan), and `'catalyst'` (dashed blue, no arrow).
- **`Group`** — parent grouping of nodes, supports collapsed summary calculation.

### Components

- **`App.vue`** — root wrapper providing Naive UI providers (`NMessageProvider`, `NNotificationProvider`, `NDialogProvider`).
- **`Editor.vue`** — main workspace with the Vue Flow canvas, toolbar, and editing interactions.
- **`ItemNode.vue`** — custom Vue Flow node displaying recipe slots, outputs, and production stats.
- **`GroupNode.vue`** — collapsible group node aggregating children with a collapsed summary view.
- **`NodeDrawer.vue`** — side drawer for editing the selected node's recipe, machine, and catalyst settings.
- **`NodePopover.vue`** — compact popover on nodes for quick info and common actions.
- **`DictionaryPanel.vue`** — left sidebar listing items and machines with drag-and-drop to canvas.
- **`SearchOverlay.vue`** — global quick-jump overlay (Ctrl+P) for locating nodes and resources.
- **`BomPanel.vue`** — right-side drawer for BOM (Bill of Materials) configuration and tree/summary views.
- **`BomTreeNodeView.vue`** — recursive tree node for BOM drill-down with status flags and highlighting.
- **`BomSummaryTable.vue`** — aggregated BOM summary table showing quantities, rates, and machine counts.
- **`ContextMenu.vue`** — right-click context menu with configurable items and keyboard shortcuts.
- **`ConfirmDialog.vue`** — teleported confirmation dialog with cancel/confirm actions.

### Mock data (`src/data/mock-data.ts`)

Demo factory production line: raw materials (Iron Ore, Copper Ore, Coal, Water, Stone) → smelting (Iron/Copper Ingot, Stone Brick) → manufacturing (Iron Plate, Copper Wire) → final products (Basic Circuit, Concrete). Includes one byproduct (Slag from Iron Smelting). Helper functions: `rawMaterial()`, `product()`, `slot()`, `edge()`.

### Styling

**Aesthetic:** Bauhaus / Suprematism inspired. Emphasizes strict grids, highly contrasted primary colors (pure red, blue, yellow), sharp geometric edges (0px border radius), and intense solid block shadows. Components must support dark/light themes via CSS variables.

**Design tokens** in `src/styles/tokens.css` — single source of truth for colors, radii, shadows, transitions, typography. **Shared overlay styles** in `src/styles/overlay.css` — base classes for context menus (`.ol-menu`), confirm dialogs (`.ol-dialog`), buttons (`.ol-btn`), and the close icon (`.close-icon`). **Shared form styles** in `src/styles/form.css` — form layout (`.form-group`, `.form-row`, `.flex-1`, `.w-70`), labels (`.section-label`, `.group-label`), byproduct picker (`.so-*`), inline number input with stepper (`.rd-input-num`, `.rd-num-btn`, `.rd-num-btn-minus/plus`), and Naive UI drawer overrides (`.rd-drawer`). All three imported once in `main.ts`.

**Rule: before writing any hardcoded color, radius, shadow, or transition value in a component `<style>` block, check `tokens.css` first. Before writing form, input, tag, label, or drawer styles, check `form.css` for a reusable class.** If a matching token or class exists, use it instead of duplicating. Only hardcode values that are truly one-off and not shared across components.

Light & Dark themes togglable via `[data-theme='dark']`. Fonts: Plus Jakarta Sans (`--font-ui`) and JetBrains Mono (`--font-mono`). Vue Flow edge labels use monospace. Node visuals use `color-mix(in srgb, ...)` with per-node `--node-color`.
