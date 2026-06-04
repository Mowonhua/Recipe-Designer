import { describe, expect, test } from 'vitest';
import { resolveRectangularCollisions, resolveZoomAwareVerticalGap } from '../layout/collision';

// 该测试节点工厂只保留防重叠算法需要的矩形信息，便于直接断言节点边缘之间的留白。
function collisionNode(id: string, x: number, y: number) {
  return { id, x, y, width: 170, height: 60 };
}

// 该辅助函数按矩形边缘计算水平间距；返回值为正数表示两个节点之间存在空隙。
function horizontalGap(leftNode: { x: number; width: number }, rightNode: { x: number }) {
  return rightNode.x - (leftNode.x + leftNode.width);
}

// 该辅助函数按矩形边缘计算垂直间距；返回值为正数表示两个节点之间存在空隙。
function verticalGap(topNode: { y: number; height: number }, bottomNode: { y: number }) {
  return bottomNode.y - (topNode.y + topNode.height);
}

describe('resolveRectangularCollisions', () => {
  test('垂直留白按当前缩放换算为屏幕可见距离', () => {
    expect(resolveZoomAwareVerticalGap({
      minGraphGap: 32,
      minScreenGap: 32,
      zoom: 0.33,
    })).toBeCloseTo(96.97, 2);
  });

  test('水平重叠节点只按节点边缘保留 2px 空隙', () => {
    const resolved = resolveRectangularCollisions({
      nodes: [
        collisionNode('dragged', 0, 0),
        collisionNode('pushed', 160, 0),
      ],
      anchoredIds: new Set(['dragged']),
    });

    expect(resolved.get('dragged')).toEqual({ x: 0, y: 0 });
    expect(horizontalGap(
      { x: resolved.get('dragged')!.x, width: 170 },
      { x: resolved.get('pushed')!.x },
    )).toBe(2);
  });

  test('垂直重叠节点保留 32px 空隙以容纳连线倍率文本', () => {
    const resolved = resolveRectangularCollisions({
      nodes: [
        collisionNode('dragged', 0, 0),
        collisionNode('pushed', 0, 55),
      ],
      anchoredIds: new Set(['dragged']),
    });

    expect(resolved.get('dragged')).toEqual({ x: 0, y: 0 });
    expect(verticalGap(
      { y: resolved.get('dragged')!.y, height: 60 },
      { y: resolved.get('pushed')!.y },
    )).toBe(32);
  });

  test('轻微水平错开的上下节点仍按垂直留白分离，避免遮盖连线倍率', () => {
    const resolved = resolveRectangularCollisions({
      nodes: [
        collisionNode('dragged', 0, 0),
        collisionNode('pushed', 200, 58),
      ],
      anchoredIds: new Set(['dragged']),
    });

    expect(resolved.get('dragged')).toEqual({ x: 0, y: 0 });
    expect(verticalGap(
      { y: resolved.get('dragged')!.y, height: 60 },
      { y: resolved.get('pushed')!.y },
    )).toBe(32);
  });

  test('正下方零间距释放后也保留完整倍率文本空间', () => {
    const resolved = resolveRectangularCollisions({
      nodes: [
        collisionNode('upper', 0, 0),
        collisionNode('dragged', 0, 60),
      ],
      anchoredIds: new Set(['dragged']),
    });

    expect(resolved.get('dragged')).toEqual({ x: 0, y: 60 });
    expect(verticalGap(
      { y: resolved.get('upper')!.y, height: 60 },
      { y: resolved.get('dragged')!.y },
    )).toBe(32);
  });
});
