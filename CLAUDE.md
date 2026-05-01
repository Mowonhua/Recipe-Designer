# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development

```bash
npm run dev          # Start Vite dev server (port 1420)
npm run build        # Type-check with vue-tsc, then Vite production build
npm run tauri        # Run Tauri CLI (e.g., `npm run tauri dev` for full desktop app)
```

Tauri coordinates with Vite automatically — `tauri dev` starts the Vite dev server before launching the desktop window. The Vite dev server MUST run on port 1420 (strictPort is set).

## Architecture

**Tauri v2 desktop app** — Vue 3 frontend with a Rust backend shell. The Rust side (`src-tauri/`) contains only a placeholder `greet` command and the boilerplate to launch the window. All meaningful logic lives in the frontend.

**Frontend stack:** Vue 3 (Composition API / `<script setup>`) + TypeScript + Pinia + Naive UI + Vue Flow + d3-force.

### State management (`src/store/index.ts`)

All application state is in a single Pinia store (`recipe-designer`). The data model:

- **`ItemNode`** — primary entity representing an item with multiple production `RecipeSlot`s. Nodes have graph positions. Each node references which slot is active (`active_slot_id`).
- **`RecipeSlot`** — how an item is produced: time, which `Machine`, tags, primary/secondary outputs, catalyst config.
- **`Machine`** — production facility with base speed, tags, and allowed recipe tags.
- **`GlobalEffect`** — multipliers on yield or speed from skills/treasure/research, filtered by target tags.
- **`FlowEdge`** — connects nodes, represents item flow with quantity. Edges are slot-specific (`target_slot_id`). Two types: `'input'` (solid gray) and `'byproduct'` (dashed blue, no arrow).
- **`Group`** — parent grouping of nodes, supports collapsed summary calculation.

### Components

- **`App.vue`** — wraps the app in Naive UI providers (`NMessageProvider`, `NNotificationProvider`, `NDialogProvider`).

- **`Editor.vue`** — main editor workspace hosting the Vue Flow canvas, controls, and editing interactions.

- **`ItemNode.vue`** — custom Vue Flow node for items, showing recipe slots, outputs, and node visuals.

- **`GroupNode.vue`** — collapsible group node that aggregates child nodes and displays a summary when collapsed.

- **`NodeDrawer.vue`** — side drawer for viewing and editing the selected node's detailed recipe and settings.

- **`NodePopover.vue`** — compact popover on nodes providing quick info and common actions.

- **`DictionaryPanel.vue`** — left sidebar (220px) listing items and machines with drag-and-drop to the canvas.

- **`SearchOverlay.vue`** — global search / quick-jump overlay (Ctrl+P) for locating nodes and resources.

### Mock data (`src/data/mock-data.ts`)

Demo factory production line: raw materials (Iron Ore, Copper Ore, Coal, Water, Stone) → smelting (Iron/Copper Ingot, Stone Brick) → manufacturing (Iron Plate, Copper Wire) → final products (Basic Circuit, Concrete). Includes one byproduct (Slag from Iron Smelting). Helper functions: `rawMaterial()`, `product()`, `slot()`, `edge()`.

### Styling

**Aesthetic:** Bauhaus / Suprematism inspired. Emphasizes strict grids, highly contrasted primary colors (pure red, blue, yellow), sharp geometric edges (0px border radius), and intense solid block shadows. Components must support dark/light themes via CSS variables.

**Design tokens** are in `src/styles/tokens.css` — the single source of truth for colors, border radii, shadows, transitions, and typography. Imported once in `main.ts`, available in every component.

**Rule: before writing any hardcoded color, radius, shadow, or transition value in a component `<style>` block, check `tokens.css` first.** If a matching token exists, use the CSS variable. Only hardcode values that are truly one-off and not shared across components.

Key token categories:
- **Text:** `--text-primary`, `--text-main`, `--text-muted`, `--text-dimmed`, `--text-disabled`
- **Backgrounds:** `--bg-color`, `--panel-bg`, `--bg-surface`, `--bg-deep`, `--bg-input`, `--bg-hover`, `--bg-header`, `--bg-context`, `--bg-toolbar-btn`
- **Borders:** `--border-default` (e.g. strict `#111111`), `--panel-border`, `--border-subtle`
- **Accent (Primary geometric colors):** `--accent-blue` (`#0050A0`), `--accent-amber` (`#FFD400`), `--accent-green` (`#008855`), `--accent-red` (`#E33939`), `--accent-orange`
- **Radii:** `--radius-sm` through `--radius-2xl` are completely `0px` (sharp edges), plus `--radius-full` (`50%`) for circles.
- **Shadows:** Hard minimal offset block shadows (e.g. `4px 4px 0px rgba(17,17,17,1)`). `--shadow-card`, `--shadow-modal`, `--shadow-menu`, `--shadow-node`, `--shadow-node-hover`, `--shadow-group`
- **Transitions:** `--transition-fast/normal/slow`, `--ease-bounce`, `--ease-smooth`
- **Layout:** `--node-width` (160px), `--node-min-height` (48px)

Light & Dark themes togglable via `[data-theme='dark']`. Fonts: Plus Jakarta Sans (`--font-ui`) and JetBrains Mono (`--font-mono`). Vue Flow edge labels use monospace. Node visuals use `color-mix(in srgb, ...)` with per-node `--node-color`.

## Key Dependencies

- **vue-flow** (`@vue-flow/core`, `@vue-flow/background`, `@vue-flow/controls`, `@vue-flow/minimap`) — node-graph editor
- **d3-force** — collision avoidance during node drag (`forceSimulation` + `forceCollide`)
- **@dagrejs/dagre** — automatic graph layout (bottom-to-top)
- **naive-ui** — UI component library (message/notification/dialog providers)
- **pinia** — state management with command-pattern undo/redo
- **lucide-vue-next** — icon library
- **uuid** — ID generation for all data model entities
