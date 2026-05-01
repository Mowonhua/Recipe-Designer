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

  isRawMaterial: boolean;
  isByproduct: boolean;
  isSurplus: boolean;
  surplusPercent?: number;
  isCatalystBlocked: boolean;
  isCycleDetected: boolean;
}

export interface BomTreeEdge {
  edgeId: string;
  sourceNodeId: string;
  sourceNodeName: string;
  sourceNodeColor: string;
  quantity: number;
  child: BomTreeNode | null;
  isByproduct?: boolean;
}

export interface BomByproduct {
  itemId: string;
  itemName: string;
  itemColor: string;
  quantity: number;
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
}

export type BomContext = State;
