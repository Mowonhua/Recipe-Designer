export interface CollisionNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ResolveCollisionInput {
  nodes: CollisionNode[];
  anchoredIds: Set<string>;
  horizontalGap?: number;
  verticalGap?: number;
  verticalClearanceHorizontalTolerance?: number;
  maxIterations?: number;
}

interface ResolveZoomAwareVerticalGapInput {
  minGraphGap: number;
  minScreenGap: number;
  zoom: number;
}

interface WorkingCollisionNode extends CollisionNode {
  anchored: boolean;
  inputIndex: number;
}

const DEFAULT_HORIZONTAL_GAP = 2;
const DEFAULT_VERTICAL_GAP = 32;
const DEFAULT_VERTICAL_CLEARANCE_HORIZONTAL_TOLERANCE = 40;
const DEFAULT_MAX_ITERATIONS = 80;

// 该函数把屏幕像素级垂直留白换算为 Vue Flow 图坐标；缩放过小时仍保证倍率文本有可见空间。
export function resolveZoomAwareVerticalGap(input: ResolveZoomAwareVerticalGapInput): number {
  const normalizedZoom = Number.isFinite(input.zoom) && input.zoom > 0 ? input.zoom : 1;
  return Math.max(input.minGraphGap, input.minScreenGap / normalizedZoom);
}

// 该入口按矩形边界解析节点重叠；水平和垂直使用不同留白，避免圆形碰撞半径造成过度推开。
export function resolveRectangularCollisions(input: ResolveCollisionInput): Map<string, { x: number; y: number }> {
  const horizontalGap = input.horizontalGap ?? DEFAULT_HORIZONTAL_GAP;
  const verticalGap = input.verticalGap ?? DEFAULT_VERTICAL_GAP;
  const verticalClearanceHorizontalTolerance = input.verticalClearanceHorizontalTolerance
    ?? DEFAULT_VERTICAL_CLEARANCE_HORIZONTAL_TOLERANCE;
  const maxIterations = input.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const workingNodes = input.nodes.map((node, index): WorkingCollisionNode => ({
    ...node,
    anchored: input.anchoredIds.has(node.id),
    inputIndex: index,
  }));

  // 多轮遍历用于处理链式推挤；每一轮只在仍有重叠时继续，防止稳定布局被反复扰动。
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let moved = false;

    for (let i = 0; i < workingNodes.length; i++) {
      for (let j = i + 1; j < workingNodes.length; j++) {
        moved = separatePair(
          workingNodes[i],
          workingNodes[j],
          horizontalGap,
          verticalGap,
          verticalClearanceHorizontalTolerance,
        ) || moved;
      }
    }

    if (!moved) break;
  }

  return new Map(workingNodes.map(node => [node.id, { x: node.x, y: node.y }]));
}

// 该函数计算两个矩形在带留白边界下是否相交，并沿最小位移轴执行一次分离。
function separatePair(
  first: WorkingCollisionNode,
  second: WorkingCollisionNode,
  horizontalGap: number,
  verticalGap: number,
  verticalClearanceHorizontalTolerance: number,
): boolean {
  if (first.anchored && second.anchored) return false;

  const firstCenterX = first.x + first.width / 2;
  const firstCenterY = first.y + first.height / 2;
  const secondCenterX = second.x + second.width / 2;
  const secondCenterY = second.y + second.height / 2;
  const deltaX = secondCenterX - firstCenterX;
  const deltaY = secondCenterY - firstCenterY;
  const requiredX = (first.width + second.width) / 2 + horizontalGap;
  const requiredY = (first.height + second.height) / 2 + verticalGap;
  const overlapX = requiredX - Math.abs(deltaX);
  const overlapY = requiredY - Math.abs(deltaY);
  const verticalStacked = isVerticalStacked(first, second, deltaY);

  if (overlapY <= 0) return false;

  if (verticalStacked && (overlapX > 0 || horizontalEdgeGap(first, second) <= verticalClearanceHorizontalTolerance)) {
    const direction = collisionDirection(deltaY, first.inputIndex, second.inputIndex);
    moveAlongAxis(first, second, 'y', direction, overlapY);
    return true;
  }

  if (overlapX > 0) {
    const direction = collisionDirection(deltaX, first.inputIndex, second.inputIndex);
    moveAlongAxis(first, second, 'x', direction, overlapX);
    return true;
  }

  return false;
}

// 该函数判断两个节点是否构成上下邻近关系；中心点纵向距离达到半个较小节点高度时，优先保护垂直倍率标签空间。
function isVerticalStacked(first: WorkingCollisionNode, second: WorkingCollisionNode, deltaY: number): boolean {
  return Math.abs(deltaY) >= Math.min(first.height, second.height) / 2;
}

// 该函数计算两个节点矩形边缘之间的水平空隙；矩形已经水平重叠时返回 0。
function horizontalEdgeGap(first: WorkingCollisionNode, second: WorkingCollisionNode): number {
  const left = first.x <= second.x ? first : second;
  const right = left === first ? second : first;
  return Math.max(0, right.x - (left.x + left.width));
}

// 该函数在两个中心完全重合时用输入顺序生成稳定方向，避免相同位置节点在多轮解析中左右抖动。
function collisionDirection(delta: number, firstIndex: number, secondIndex: number): number {
  if (delta < 0) return -1;
  if (delta > 0) return 1;
  return firstIndex <= secondIndex ? 1 : -1;
}

// 该函数根据锚定状态分配位移；被拖拽节点不移动，两个普通节点则平分最小分离距离。
function moveAlongAxis(
  first: WorkingCollisionNode,
  second: WorkingCollisionNode,
  axis: 'x' | 'y',
  direction: number,
  overlap: number,
) {
  if (first.anchored) {
    second[axis] += direction * overlap;
    return;
  }

  if (second.anchored) {
    first[axis] -= direction * overlap;
    return;
  }

  first[axis] -= direction * overlap / 2;
  second[axis] += direction * overlap / 2;
}
