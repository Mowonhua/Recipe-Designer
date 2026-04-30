import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { findOrphans, type ValidationError } from './validation';

// --- Data Models (from Design Scheme) ---
export interface GlobalEffect {
  id: string;
  name: string;
  source: 'skill' | 'treasure' | 'research' | 'other';
  type: 'recipe_yield' | 'machine_speed';
  target_tags: string[];
  multiplier: number;
}

export interface Machine {
  id: string;
  name: string;
  base_speed: number;
  tags: string[];
  allowed_recipe_tags: string[];
}

export interface RecipeSlot {
  id: string;
  name: string;
  time: number;
  machine_id: string;
  tags: string[];
  primary_output_quantity: number;
  secondary_outputs: { item_id: string; quantity: number }[];
  catalyst_mode: 'none' | 'optional' | 'required';
  catalyst?: { item_id: string; quantity: number; speed_multiplier?: number };
}

export interface ItemNode {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  tags: string[];
  is_raw_material: boolean | null;
  active_slot_id?: string;
  slots: RecipeSlot[];
  position: { x: number; y: number };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  target_slot_id: string;
  quantity: number;
  edge_type: 'input' | 'byproduct';
}

export interface Group {
  id: string;
  name: string;
  children: string[];
  collapsed: boolean;
  summary_recipe?: {
    inputs: { item_id: string; quantity: number }[];
    outputs: { item_id: string; quantity: number }[];
    time: number;
  };
}

export interface Viewport {
  zoom: number;
  center: { x: number; y: number };
}

export interface ProjectMeta {
  created: string;
  updated: string;
  game: string;
  viewport: Viewport;
}

export interface State {
  version: number;
  meta: ProjectMeta;
  global_effects: GlobalEffect[];
  machines: Machine[];
  nodes: ItemNode[];
  edges: FlowEdge[];
  groups: Group[];
}

// --- Command Pattern for Undo/Redo ---
export interface Command {
  execute(state: State): void;
  undo(state: State): void;
}

// --- Concrete Commands ---

class AddNodeCommand implements Command {
  constructor(private node: ItemNode) {}
  execute(state: State) { state.nodes.push(this.node); }
  undo(state: State) {
    const idx = state.nodes.findIndex(n => n.id === this.node.id);
    if (idx >= 0) state.nodes.splice(idx, 1);
  }
}

class DeleteNodesCommand implements Command {
  private deletedNodes: ItemNode[] = [];
  private deletedEdges: FlowEdge[] = [];
  constructor(private nodeIds: string[]) {}
  execute(state: State) {
    const ids = new Set(this.nodeIds);
    this.deletedNodes = state.nodes.filter(n => ids.has(n.id));
    this.deletedEdges = state.edges.filter(e => ids.has(e.source) || ids.has(e.target));

    // Mutate arrays in-place (state.nodes/edges share reference with Pinia refs)
    const keepNodes = state.nodes.filter(n => !ids.has(n.id));
    const keepEdges = state.edges.filter(e => !ids.has(e.source) && !ids.has(e.target));
    state.nodes.length = 0;
    state.nodes.push(...keepNodes);
    state.edges.length = 0;
    state.edges.push(...keepEdges);
  }
  undo(state: State) {
    state.nodes.push(...this.deletedNodes);
    state.edges.push(...this.deletedEdges);
  }
}

class MoveNodesCommand implements Command {
  constructor(
    private moves: Array<{ id: string; from: { x: number; y: number }; to: { x: number; y: number } }>
  ) {}
  execute(state: State) {
    for (const m of this.moves) {
      const node = state.nodes.find(n => n.id === m.id);
      if (node) node.position = { ...m.to };
    }
  }
  undo(state: State) {
    for (const m of this.moves) {
      const node = state.nodes.find(n => n.id === m.id);
      if (node) node.position = { ...m.from };
    }
  }
}

class AddEdgeCommand implements Command {
  constructor(private edge: FlowEdge) {}
  execute(state: State) { state.edges.push(this.edge); }
  undo(state: State) {
    const idx = state.edges.findIndex(e => e.id === this.edge.id);
    if (idx >= 0) state.edges.splice(idx, 1);
  }
}

class DeleteEdgeCommand implements Command {
  private deletedEdge!: FlowEdge;
  constructor(private edgeId: string) {}
  execute(state: State) {
    const idx = state.edges.findIndex(e => e.id === this.edgeId);
    if (idx >= 0) {
      this.deletedEdge = state.edges[idx];
      state.edges.splice(idx, 1);
    }
  }
  undo(state: State) {
    if (this.deletedEdge) state.edges.push(this.deletedEdge);
  }
}

class UpdateEdgeCommand implements Command {
  private oldValues: Partial<FlowEdge> = {};
  constructor(
    private edgeId: string,
    private changes: Partial<FlowEdge>
  ) {}
  execute(state: State) {
    const edge = state.edges.find(e => e.id === this.edgeId);
    if (edge) {
      for (const key of Object.keys(this.changes) as (keyof FlowEdge)[]) {
        this.oldValues[key] = edge[key] as never;
        (edge as unknown as Record<string, unknown>)[key] = this.changes[key];
      }
    }
  }
  undo(state: State) {
    const edge = state.edges.find(e => e.id === this.edgeId);
    if (edge) {
      for (const key of Object.keys(this.oldValues) as (keyof FlowEdge)[]) {
        (edge as unknown as Record<string, unknown>)[key] = this.oldValues[key];
      }
    }
  }
}

class AddSlotCommand implements Command {
  constructor(
    private nodeId: string,
    private slot: RecipeSlot
  ) {}
  execute(state: State) {
    const node = state.nodes.find(n => n.id === this.nodeId);
    if (node) node.slots.push(this.slot);
  }
  undo(state: State) {
    const node = state.nodes.find(n => n.id === this.nodeId);
    if (node) {
      const idx = node.slots.findIndex(s => s.id === this.slot.id);
      if (idx >= 0) node.slots.splice(idx, 1);
    }
  }
}

class SetActiveSlotCommand implements Command {
  private oldSlotId: string | undefined;
  constructor(
    private nodeId: string,
    private slotId: string | undefined
  ) {}
  execute(state: State) {
    const node = state.nodes.find(n => n.id === this.nodeId);
    if (node) {
      this.oldSlotId = node.active_slot_id;
      node.active_slot_id = this.slotId;
    }
  }
  undo(state: State) {
    const node = state.nodes.find(n => n.id === this.nodeId);
    if (node) node.active_slot_id = this.oldSlotId;
  }
}

// --- Store ---

const OFF_CANVAS = -9999;

export const useStore = defineStore('recipe-designer', () => {
  const version = ref<number>(1);
  const meta = ref<ProjectMeta>({
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    game: 'New Game',
    viewport: { zoom: 1.0, center: { x: 0, y: 0 } },
  });
  
  const global_effects = ref<GlobalEffect[]>([]);
  const machines = ref<Machine[]>([]);
  const nodes = ref<ItemNode[]>([]);
  const edges = ref<FlowEdge[]>([]);
  const groups = ref<Group[]>([]);

  const validationErrors = ref<ValidationError[]>([]);

  function clearValidation() {
    validationErrors.value = [];
  }

  function setValidationErrors(errors: ValidationError[]) {
    validationErrors.value = errors;
  }

  // Command History Stack
  const history = ref<Command[]>([]);
  const historyIndex = ref<number>(-1);
  const maxHistory = 200;

  // Incremented on every structural change for external sync
  const changeCounter = ref(0);

  const commit = (command: Command) => {
    // Drop future history if we're not at the end
    if (historyIndex.value < history.value.length - 1) {
      history.value = history.value.slice(0, historyIndex.value + 1);
    }
    
    // Execute and save
    command.execute({
      version: version.value,
      meta: meta.value,
      global_effects: global_effects.value,
      machines: machines.value,
      nodes: nodes.value,
      edges: edges.value,
      groups: groups.value
    });
    
    meta.value.updated = new Date().toISOString();
    history.value.push(command);
    
    if (history.value.length > maxHistory) {
      history.value.shift();
    } else {
      historyIndex.value++;
    }
  };

  const undo = () => {
    if (historyIndex.value >= 0) {
      const command = history.value[historyIndex.value];
      command.undo({
        version: version.value,
        meta: meta.value,
        global_effects: global_effects.value,
        machines: machines.value,
        nodes: nodes.value,
        edges: edges.value,
        groups: groups.value
      });
      historyIndex.value--;
      meta.value.updated = new Date().toISOString();
      changeCounter.value++;
    }
  };

  const redo = () => {
    if (historyIndex.value < history.value.length - 1) {
      historyIndex.value++;
      const command = history.value[historyIndex.value];
      command.execute({
        version: version.value,
        meta: meta.value,
        global_effects: global_effects.value,
        machines: machines.value,
        nodes: nodes.value,
        edges: edges.value,
        groups: groups.value
      });
      meta.value.updated = new Date().toISOString();
      changeCounter.value++;
    }
  };
  
  const derivedEdgeLabel = computed(() => {
    return (edgeId: string) => {
      const edge = edges.value.find(e => e.id === edgeId);
      return edge ? `x${edge.quantity}` : '';
    };
  });

  // --- Actions (wrap commands for undo/redo) ---

  function addNode(node: ItemNode) {
    commit(new AddNodeCommand(node));
    changeCounter.value++;
  }

  function deleteNodes(ids: string[]) {
    if (ids.length === 0) return;
    commit(new DeleteNodesCommand(ids));
    changeCounter.value++;
  }

  function moveNodes(moves: Array<{ id: string; from: { x: number; y: number }; to: { x: number; y: number } }>) {
    if (moves.length === 0) return;
    commit(new MoveNodesCommand(moves));
    // Don't bump changeCounter for position-only changes (avoids re-sync loop with Vue Flow)
  }

  function addEdge(edge: FlowEdge) {
    commit(new AddEdgeCommand(edge));
    changeCounter.value++;
  }

  function deleteEdge(id: string) {
    commit(new DeleteEdgeCommand(id));
    changeCounter.value++;
  }

  function updateEdge(id: string, changes: Partial<FlowEdge>) {
    commit(new UpdateEdgeCommand(id, changes));
    changeCounter.value++;
  }

  function addSlot(nodeId: string, slot: RecipeSlot) {
    commit(new AddSlotCommand(nodeId, slot));
    changeCounter.value++;
  }

  function deleteSlot(nodeId: string, slotId: string) {
    // Remove edges targeting this slot first
    const slotEdges = edges.value.filter(e => e.target === nodeId && e.target_slot_id === slotId);
    for (const e of slotEdges) {
      commit(new DeleteEdgeCommand(e.id));
    }
    // For simplicity: find node, remove slot from array, re-add node with updated slots
    // Using a simpler approach: mutate the slots array directly within a command
    commit(new (class implements Command {
      private nodeId: string;
      private slotId: string;
      private deletedSlot?: RecipeSlot;
      constructor(nodeId: string, slotId: string) {
        this.nodeId = nodeId;
        this.slotId = slotId;
      }
      execute(state: State) {
        const node = state.nodes.find(n => n.id === this.nodeId);
        if (node) {
          const idx = node.slots.findIndex(s => s.id === this.slotId);
          if (idx >= 0) {
            this.deletedSlot = node.slots[idx];
            node.slots.splice(idx, 1);
          }
        }
      }
      undo(state: State) {
        if (this.deletedSlot) {
          const node = state.nodes.find(n => n.id === this.nodeId);
          if (node) node.slots.push(this.deletedSlot);
        }
      }
    })(nodeId, slotId));
    changeCounter.value++;
  }

  function setActiveSlot(nodeId: string, slotId: string | undefined) {
    commit(new SetActiveSlotCommand(nodeId, slotId));
    changeCounter.value++;
  }

  function addMachine(machine: Machine) {
    machines.value.push(machine);
    changeCounter.value++;
  }

  function updateMachine(id: string, changes: Partial<Machine>) {
    const machine = machines.value.find(m => m.id === id);
    if (machine) {
      Object.assign(machine, changes);
      changeCounter.value++;
    }
  }

  function deleteMachine(id: string) {
    const idx = machines.value.findIndex(m => m.id === id);
    if (idx >= 0) {
      machines.value.splice(idx, 1);
      changeCounter.value++;
    }
  }

  function addItem(name: string, color?: string, tags?: string[]): ItemNode {
    const node: ItemNode = {
      id: uuidv4(),
      name,
      color: color || '#3b82f6',
      tags: tags || [],
      is_raw_material: null,
      slots: [],
      position: { x: OFF_CANVAS, y: OFF_CANVAS },
    };
    commit(new AddNodeCommand(node));
    changeCounter.value++;
    return node;
  }

  function updateItem(id: string, changes: Partial<ItemNode>) {
    const node = nodes.value.find(n => n.id === id);
    if (node) {
      const { id: _, slots: __, position: ___, active_slot_id: ____, ...safeChanges } = changes as any;
      Object.assign(node, safeChanges);
      changeCounter.value++;
    }
  }

  function placeNodeOnCanvas(nodeId: string, position: { x: number; y: number }) {
    const node = nodes.value.find(n => n.id === nodeId);
    if (node && node.position.x === OFF_CANVAS && node.position.y === OFF_CANVAS) {
      node.position = position;
      changeCounter.value++;
    }
  }

  function isNodeOnCanvas(nodeId: string): boolean {
    const node = nodes.value.find(n => n.id === nodeId);
    return node ? !(node.position.x === OFF_CANVAS && node.position.y === OFF_CANVAS) : false;
  }

  function addGroup(name: string, childIds: string[]) {
    const group: Group = {
      id: uuidv4(),
      name,
      children: childIds,
      collapsed: false,
    };
    groups.value.push(group);
    changeCounter.value++;
  }

  function removeGroup(id: string) {
    const idx = groups.value.findIndex(g => g.id === id);
    if (idx >= 0) {
      groups.value.splice(idx, 1);
      changeCounter.value++;
    }
  }

  function toggleGroupCollapse(id: string) {
    const group = groups.value.find(g => g.id === id);
    if (group) {
      group.collapsed = !group.collapsed;
      if (group.collapsed) {
        updateGroupSummary(id);
      }
      changeCounter.value++;
    }
  }

  function updateGroupSummary(groupId: string) {
    const group = groups.value.find(g => g.id === groupId);
    if (!group) return;

    const childSet = new Set(group.children);

    const inputMap = new Map<string, number>();
    const outputMap = new Map<string, number>();

    for (const edge of edges.value) {
      const sourceInside = childSet.has(edge.source);
      const targetInside = childSet.has(edge.target);

      if (!sourceInside && targetInside) {
        inputMap.set(edge.source, (inputMap.get(edge.source) || 0) + edge.quantity);
      } else if (sourceInside && !targetInside) {
        outputMap.set(edge.target, (outputMap.get(edge.target) || 0) + edge.quantity);
      }
    }

    let maxTime = 0;
    for (const nodeId of group.children) {
      const node = nodes.value.find(n => n.id === nodeId);
      if (!node) continue;
      for (const slot of node.slots) {
        if (slot.time > maxTime) maxTime = slot.time;
      }
    }

    group.summary_recipe = {
      inputs: Array.from(inputMap.entries()).map(([item_id, quantity]) => ({ item_id, quantity })),
      outputs: Array.from(outputMap.entries()).map(([item_id, quantity]) => ({ item_id, quantity })),
      time: maxTime,
    };
  }

  function deleteOrphans() {
    const state = getState();
    const orphans = findOrphans(state);
    const ids = orphans.map(n => n.id);
    if (ids.length > 0) {
      deleteNodes(ids);
    }
  }

  // Helper to construct State object for pure functions
  function getState(): State {
    return {
      version: version.value,
      meta: meta.value,
      global_effects: global_effects.value,
      machines: machines.value,
      nodes: nodes.value,
      edges: edges.value,
      groups: groups.value,
    };
  }

  function seedData(data: { nodes: ItemNode[]; edges: FlowEdge[]; machines: Machine[] }) {
    nodes.value = data.nodes;
    edges.value = data.edges;
    machines.value = data.machines;
    // Clear history when seeding
    history.value = [];
    historyIndex.value = -1;
    changeCounter.value++;
  }

  return {
    version,
    meta,
    global_effects,
    machines,
    nodes,
    edges,
    groups,
    validationErrors,
    commit,
    undo,
    redo,
    history,
    historyIndex,
    changeCounter,
    derivedEdgeLabel,
    addNode,
    deleteNodes,
    moveNodes,
    addEdge,
    deleteEdge,
    updateEdge,
    addSlot,
    deleteSlot,
    setActiveSlot,
    addMachine,
    updateMachine,
    deleteMachine,
    addItem,
    updateItem,
    placeNodeOnCanvas,
    isNodeOnCanvas,
    addGroup,
    removeGroup,
    toggleGroupCollapse,
    updateGroupSummary,
    deleteOrphans,
    getState,
    clearValidation,
    setValidationErrors,
    seedData,
  };
});
