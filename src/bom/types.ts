import type { State } from '../store';

export type CalculationMode = 'one-time' | 'continuous';
export type BalancingStrategy = 'integer-rounding' | 'exact-decimal';
export type ByproductStrategy = 'ignore-annotate' | 'offset' | 'independent-output';

export interface BomRequest {
  nodeId: string;
  slotId: string;
  mode: CalculationMode;
  targetQuantity: number;
  balancingStrategy: BalancingStrategy;
  byproductStrategy: ByproductStrategy;
  proliferatorAssignments?: Record<string, string>;
}

export interface BomTreeNode {
  nodeId: string;
  nodeName: string;
  nodeColor: string;
  slotId: string;
  slotName: string;
  depth: number;

  // One-time mode
  executionCount?: number;

  // Continuous mode
  machineCount?: number;
  actualOutputRate?: number;

  // Common
  targetQuantity: number;
  inputs: BomTreeEdge[];
  byproducts: BomByproduct[];
  catalyst?: BomTreeEdge;
  proliferator?: BomTreeEdge;

  isRawMaterial: boolean;
  isByproduct: boolean;
  isSurplus: boolean;
  surplusPercent?: number;
  isCatalystBlocked: boolean;
  isCycleDetected: boolean;
  proliferatorMultiplier?: number;
  globalYieldMultiplier?: number;
}

export interface BomTreeEdge {
  edgeId: string;
  sourceNodeId: string;
  sourceNodeName: string;
  sourceNodeColor: string;
  quantity: number;
  recipeQuantity: number;
  child: BomTreeNode | null;
  isByproduct?: boolean;
  isCatalyst?: boolean;
  isProliferator?: boolean;
}

export interface BomByproduct {
  itemId: string;
  itemName: string;
  itemColor: string;
  quantity: number;
  recipeQuantity: number;
  offsetConsumed?: number;
}

export interface BomSummaryRow {
  itemId: string;
  itemName: string;
  itemColor: string;
  totalQuantity?: number;
  totalRate?: number;
  totalMachines?: number;
  isRawMaterial: boolean;
  isByproduct: boolean;
  isCatalyst?: boolean;
  isProliferator?: boolean;
  isSurplus: boolean;
  surplusPercent?: number;
}

export interface BomResult {
  request: BomRequest;
  tree: BomTreeNode;
  summary: BomSummaryRow[];
  warnings: BomWarning[];
  computedAt: number;
}

export interface BomWarning {
  type: 'cycle' | 'catalyst_missing' | 'no_active_slot' | 'no_inputs';
  nodeId: string;
  message: string;
}

export interface MultiplierSet {
  yieldMultiplier: number;
  speedMultiplier: number;
  proliferatorMultiplier: number;
  globalYieldMultiplier: number;
  globalSpeedMultiplier: number;
}

export type BomContext = State;
