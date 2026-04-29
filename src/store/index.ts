import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';

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

  // Command History Stack
  const history = ref<Command[]>([]);
  const historyIndex = ref<number>(-1);
  const maxHistory = 200;

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
    }
  };
  
  const derivedEdgeLabel = computed(() => {
    return (edgeId: string) => {
      const edge = edges.value.find(e => e.id === edgeId);
      return edge ? \`x\${edge.quantity}\` : '';
    };
  });

  return {
    version,
    meta,
    global_effects,
    machines,
    nodes,
    edges,
    groups,
    commit,
    undo,
    redo,
    history,
    historyIndex,
    derivedEdgeLabel
  };
});
