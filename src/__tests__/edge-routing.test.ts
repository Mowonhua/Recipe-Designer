import { describe, expect, test } from 'vitest';
import { Position } from '@vue-flow/core';
import {
  getDirectionHandlePositions,
  getRecipeEdgeRoute,
  type RecipeEdgeStyle,
} from '../layout/edge-routing';
import type { LayoutDirection } from '../store';

// 该工厂方法创建可复用的路由输入，测试只关心端点坐标、方向、样式和 lane 信息。
function routeInput(overrides: Partial<Parameters<typeof getRecipeEdgeRoute>[0]> = {}) {
  return {
    sourceX: 100,
    sourceY: 100,
    targetX: 420,
    targetY: 100,
    direction: 'LR' as LayoutDirection,
    edgeStyle: 'step' as RecipeEdgeStyle,
    laneIndex: 0,
    laneCount: 1,
    ...overrides,
  };
}

describe('edge-routing', () => {
  test('自左向右布局使用右侧出口和左侧入口', () => {
    expect(getDirectionHandlePositions('LR')).toEqual({
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });
  });

  test('纵向布局使用对应的上下端口方向', () => {
    expect(getDirectionHandlePositions('TB')).toEqual({
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });
    expect(getDirectionHandlePositions('BT')).toEqual({
      sourcePosition: Position.Top,
      targetPosition: Position.Bottom,
    });
  });

  test('step 类边把倍率标签放在节点出口直线段上', () => {
    const route = getRecipeEdgeRoute(routeInput());

    expect(route.labelAnchor).toBe('source-segment');
    expect(route.labelX).toBeGreaterThan(100);
    expect(route.labelX).toBeLessThan(170);
    expect(route.labelY).toBe(100);
  });

  test('同源同目标的 step 类边使用不同 lane，避免水平中段完全重合', () => {
    const first = getRecipeEdgeRoute(routeInput({ laneIndex: 0, laneCount: 2 }));
    const second = getRecipeEdgeRoute(routeInput({ laneIndex: 1, laneCount: 2 }));

    expect(first.laneOffset).not.toBe(second.laneOffset);
    expect(first.path).not.toBe(second.path);
  });
});
