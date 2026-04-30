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

**Undo/redo** uses a Command pattern. `commit(command)` executes the command and pushes it onto the history stack (`maxHistory = 200`). `undo()`/`redo()` replay commands from the stack. Each Command implements `{ execute(state), undo(state) }` receiving the full `State` snapshot. Concrete commands: `AddNode`, `DeleteNodes`, `MoveNodes`, `AddEdge`, `DeleteEdge`, `UpdateEdge`, `AddSlot`, `SetActiveSlot`, and an inline anonymous class for `deleteSlot`.

`changeCounter` is bumped on structural changes (nodes/edges added/removed) to trigger `syncFromStore()`. Position-only changes via `moveNodes` do NOT bump it (prevents re-sync loop with Vue Flow during drag).

### Components

- **`App.vue`** — wraps the app in Naive UI providers (`NMessageProvider`, `NNotificationProvider`, `NDialogProvider`). Defines dark-theme CSS custom properties (`--bg-color`, `--panel-bg`, `--text-main`, etc.) and global Vue Flow style overrides (minimap, controls, edge labels).

- **`Editor.vue`** — the main editor workspace. Contains the Vue Flow graph canvas with fit-view-on-init, snap-to-grid `[20, 20]`, zoom range 0.1–3x. Renders `Background`, `Controls`, `MiniMap` bottom-right. Handles:
  - **Drag with collision avoidance:** `@node-drag-start` snapshots all node positions. `@node-drag` runs d3 `forceCollide` in real-time, anchoring dragged nodes and directly mutating local `nodes.value` for pushed nodes (bypasses store to avoid history spam). `@node-drag-stop` does a final collision pass, then commits all position changes (dragged + pushed) as a single atomic `store.moveNodes()` for undo/redo.
  - **Connection:** `@connect` creates edges with lazy slot creation — if the target node has no slots, a default `RecipeSlot` is created automatically. Self-connections are blocked.
  - **Deletion:** Batches `@nodes-change`/`@edges-change` removals via `setTimeout(0)` to group multi-node deletions into one `DeleteNodesCommand`.
  - **Edge editing:** `@edge-double-click` prompts for quantity on the selected edge.
  - **Layout:** `applyLayout()` uses `@dagrejs/dagre` with `rankdir: 'BT'` (bottom-to-top), called once on mount after seeding mock data.
  - **Keyboard shortcuts:** Ctrl+Z (undo), Ctrl+Y (redo), Ctrl+P (search overlay), Escape (close search).
  - Provides `isConnecting` ref to child components via `provide`.

- **`ItemNode.vue`** — custom Vue Flow node (`type: 'item'`). Renders:
  - **Source handle** (top, circular) — emits connections. Grows on hover.
  - **Target handles** (bottom, pill-shaped) — one per `RecipeSlot`, positioned evenly across the node width. `connectable-start="false"` prevents dragging connections out from them.
  - **Slot labels** — appear on node hover only (`opacity` toggle), positioned below each target handle.
  - Visual states: `orphan` (dashed border, dimmed), `selected` (colored border with glow), hover (lift + shadow). Color tinting via `--node-color` CSS variable using `color-mix()`.

- **`DictionaryPanel.vue`** — left sidebar (220px) with Items/Machines tabs. Lists store nodes (with color dot, name, "on canvas" badge) and machines (with speed badge). Double-clicking an item dispatches a `search-fly-to` custom event that Editor listens to for viewport centering. "New Item" / "New Machine" placeholders at the bottom (not yet wired up).

- **`SearchOverlay.vue`** — Cmd+P search modal. Full-text search across items (by name/tags), machines (by name/tags), and slots (by name/tags). Results grouped by type with keyboard navigation (↑↓), Enter to select and fly-to. Filter tabs: All / Items / Machines / Slots. Closes on Escape or backdrop click.

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
