import { Position } from '@vue-flow/core';
import type { EdgeStyle, LayoutDirection } from '../store';

export type RecipeEdgeStyle = EdgeStyle;

type Point = { x: number; y: number };

export interface RecipeEdgeRouteInput {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  direction: LayoutDirection;
  edgeStyle: RecipeEdgeStyle;
  laneIndex: number;
  laneCount: number;
}

export interface RecipeEdgeRoute {
  path: string;
  labelX: number;
  labelY: number;
  labelAnchor: 'source-segment' | 'target-segment' | 'center';
  laneOffset: number;
}

const SOURCE_SEGMENT_LENGTH = 54;
const TARGET_SEGMENT_LENGTH = 32;
const LANE_GAP = 14;
const BEZIER_CURVATURE = 0.28;

// 该函数按当前布局方向定义边的出入口端口，保证边从生产流向的前进方向离开节点。
export function getDirectionHandlePositions(direction: LayoutDirection): {
  sourcePosition: Position;
  targetPosition: Position;
} {
  if (direction === 'LR') {
    return { sourcePosition: Position.Right, targetPosition: Position.Left };
  }

  if (direction === 'TB') {
    return { sourcePosition: Position.Bottom, targetPosition: Position.Top };
  }

  return { sourcePosition: Position.Top, targetPosition: Position.Bottom };
}

// 该函数生成自定义边路径和标签坐标；step/smoothstep 使用 lane 偏移，避免多边共用同一正交线段。
export function getRecipeEdgeRoute(input: RecipeEdgeRouteInput): RecipeEdgeRoute {
  const laneOffset = computeLaneOffset(input.laneIndex, input.laneCount);

  if (input.edgeStyle === 'straight') {
    return buildStraightRoute(input, laneOffset);
  }

  if (input.edgeStyle === 'default' || input.edgeStyle === 'simplebezier') {
    return buildBezierRoute(input, laneOffset);
  }

  return buildOrthogonalRoute(input, laneOffset, input.edgeStyle === 'smoothstep');
}

// 该函数把同组边的顺序映射为以 0 为中心的 lane 偏移，保证单边不偏移，多边对称错开。
function computeLaneOffset(laneIndex: number, laneCount: number): number {
  if (laneCount <= 1) return 0;
  return (laneIndex - (laneCount - 1) / 2) * LANE_GAP;
}

// 该函数生成直线边；标签保持在线段中心，避免直线边被误放到不存在的出口折线段。
function buildStraightRoute(input: RecipeEdgeRouteInput, laneOffset: number): RecipeEdgeRoute {
  return {
    path: `M ${input.sourceX} ${input.sourceY} L ${input.targetX} ${input.targetY}`,
    labelX: (input.sourceX + input.targetX) / 2,
    labelY: (input.sourceY + input.targetY) / 2,
    labelAnchor: 'center',
    laneOffset,
  };
}

// 该函数生成贝塞尔边；lane 以控制点偏移表达，保持曲线风格同时减少多边完全重合。
function buildBezierRoute(input: RecipeEdgeRouteInput, laneOffset: number): RecipeEdgeRoute {
  const sourceVector = directionVector(input.direction);
  const targetVector = { x: -sourceVector.x, y: -sourceVector.y };
  const distance = Math.max(
    80,
    Math.abs(input.targetX - input.sourceX) + Math.abs(input.targetY - input.sourceY),
  );
  const controlDistance = distance * BEZIER_CURVATURE;
  const normal = normalVector(input.direction);
  const sourceControl = {
    x: input.sourceX + sourceVector.x * controlDistance + normal.x * laneOffset,
    y: input.sourceY + sourceVector.y * controlDistance + normal.y * laneOffset,
  };
  const targetControl = {
    x: input.targetX + targetVector.x * controlDistance + normal.x * laneOffset,
    y: input.targetY + targetVector.y * controlDistance + normal.y * laneOffset,
  };
  const label = labelOnSourceSegment(input, laneOffset);

  return {
    path: `M ${input.sourceX} ${input.sourceY} C ${sourceControl.x} ${sourceControl.y}, ${targetControl.x} ${targetControl.y}, ${input.targetX} ${input.targetY}`,
    labelX: label.x,
    labelY: label.y,
    labelAnchor: 'source-segment',
    laneOffset,
  };
}

// 该函数生成正交折线路径；中间通道使用 laneOffset 错开，共线边会被拆分到不同通道。
function buildOrthogonalRoute(
  input: RecipeEdgeRouteInput,
  laneOffset: number,
  rounded: boolean,
): RecipeEdgeRoute {
  const sourceVector = directionVector(input.direction);
  const targetVector = { x: -sourceVector.x, y: -sourceVector.y };
  const normal = normalVector(input.direction);
  const sourceExit = {
    x: input.sourceX + sourceVector.x * SOURCE_SEGMENT_LENGTH,
    y: input.sourceY + sourceVector.y * SOURCE_SEGMENT_LENGTH,
  };
  const targetEntry = {
    x: input.targetX + targetVector.x * TARGET_SEGMENT_LENGTH,
    y: input.targetY + targetVector.y * TARGET_SEGMENT_LENGTH,
  };
  const sourceLane = {
    x: sourceExit.x + normal.x * laneOffset,
    y: sourceExit.y + normal.y * laneOffset,
  };
  const targetLane = {
    x: targetEntry.x + normal.x * laneOffset,
    y: targetEntry.y + normal.y * laneOffset,
  };
  const mid = {
    x: (sourceLane.x + targetLane.x) / 2,
    y: (sourceLane.y + targetLane.y) / 2,
  };
  const points = input.direction === 'LR'
    ? [
        { x: input.sourceX, y: input.sourceY },
        sourceExit,
        sourceLane,
        { x: mid.x, y: sourceLane.y },
        { x: mid.x, y: targetLane.y },
        targetLane,
        targetEntry,
        { x: input.targetX, y: input.targetY },
      ]
    : [
        { x: input.sourceX, y: input.sourceY },
        sourceExit,
        sourceLane,
        { x: sourceLane.x, y: mid.y },
        { x: targetLane.x, y: mid.y },
        targetLane,
        targetEntry,
        { x: input.targetX, y: input.targetY },
      ];
  const label = labelOnSourceSegment(input, laneOffset);

  return {
    path: rounded ? roundedPolylinePath(points, 8) : polylinePath(points),
    labelX: label.x,
    labelY: label.y,
    labelAnchor: 'source-segment',
    laneOffset,
  };
}

// 该函数把点序列转换为普通 SVG 折线路径。
function polylinePath(points: Point[]): string {
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} ${rest.map(point => `L ${point.x} ${point.y}`).join(' ')}`;
}

// 该函数为正交折线拐角添加二次曲线圆角，用于 smoothstep 风格。
function roundedPolylinePath(points: Point[], radius: number): string {
  if (points.length <= 2) return polylinePath(points);

  const commands = [`M ${points[0].x} ${points[0].y}`];

  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const distanceToPrevious = Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y);
    const distanceToNext = Math.abs(next.x - current.x) + Math.abs(next.y - current.y);
    const cornerRadius = Math.min(radius, distanceToPrevious / 2, distanceToNext / 2);
    const before = moveToward(current, previous, cornerRadius);
    const after = moveToward(current, next, cornerRadius);

    commands.push(`L ${before.x} ${before.y}`);
    commands.push(`Q ${current.x} ${current.y} ${after.x} ${after.y}`);
  }

  const last = points[points.length - 1];
  commands.push(`L ${last.x} ${last.y}`);
  return commands.join(' ');
}

// 该函数在正交线段上从拐点向相邻点移动指定距离，用于构造圆角切点。
function moveToward(from: Point, to: Point, distance: number): Point {
  if (from.x !== to.x) {
    return { x: from.x + Math.sign(to.x - from.x) * distance, y: from.y };
  }

  return { x: from.x, y: from.y + Math.sign(to.y - from.y) * distance };
}

// 该函数把标签固定到源节点出口短线段，标签归属更接近源节点，避免落在公共中段上。
function labelOnSourceSegment(input: RecipeEdgeRouteInput, laneOffset: number): Point {
  const sourceVector = directionVector(input.direction);
  const normal = normalVector(input.direction);
  const labelDistance = Math.min(38, SOURCE_SEGMENT_LENGTH - 12);

  return {
    x: input.sourceX + sourceVector.x * labelDistance + normal.x * laneOffset,
    y: input.sourceY + sourceVector.y * labelDistance + normal.y * laneOffset,
  };
}

// 该函数返回生产流向对应的单位方向向量。
function directionVector(direction: LayoutDirection): Point {
  if (direction === 'LR') return { x: 1, y: 0 };
  if (direction === 'TB') return { x: 0, y: 1 };
  return { x: 0, y: -1 };
}

// 该函数返回与生产流向垂直的 lane 偏移方向。
function normalVector(direction: LayoutDirection): Point {
  if (direction === 'LR') return { x: 0, y: 1 };
  return { x: 1, y: 0 };
}
