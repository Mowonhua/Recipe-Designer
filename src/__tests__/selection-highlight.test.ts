import { describe, expect, test } from 'vitest';
import { collectSelectionHighlight } from '../graph/selection-highlight';
import type { FlowEdge } from '../store';

// 该工厂方法生成最小可用的业务连线，测试只覆盖关联高亮所需的端点和边类型数据。
function edge(overrides: Partial<FlowEdge>): FlowEdge {
  return {
    id: 'edge',
    source: 'source',
    target: 'target',
    target_slot_id: 'slot',
    quantity: 1,
    edge_type: 'input',
    ...overrides,
  };
}

describe('collectSelectionHighlight', () => {
  test('选中普通节点时收集所有直接输入输出节点和连线', () => {
    const result = collectSelectionHighlight('plate', [
      edge({ id: 'ore-ingot', source: 'ore', target: 'ingot' }),
      edge({ id: 'ingot-plate', source: 'ingot', target: 'plate' }),
      edge({ id: 'plate-circuit', source: 'plate', target: 'circuit' }),
      edge({ id: 'coal-brick', source: 'coal', target: 'brick' }),
    ]);

    expect([...result.nodeIds].sort()).toEqual(['circuit', 'ingot', 'plate']);
    expect([...result.edgeIds].sort()).toEqual(['ingot-plate', 'plate-circuit']);
  });

  test('没有选中节点时返回空集合，避免画布误进入高亮态', () => {
    const result = collectSelectionHighlight(null, [
      edge({ id: 'ore-ingot', source: 'ore', target: 'ingot' }),
    ]);

    expect(result.nodeIds.size).toBe(0);
    expect(result.edgeIds.size).toBe(0);
  });
});
