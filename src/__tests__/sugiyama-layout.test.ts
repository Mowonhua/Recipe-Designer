import { describe, expect, test } from 'vitest';
import { calculateSugiyamaLayout } from '../layout/sugiyama';
import type { FlowEdge, ItemNode, LayoutDirection } from '../store';

// 该工厂方法只保留布局算法需要读取的节点字段，避免测试数据掺入配方编辑器的无关状态。
function node(id: string, x = 0, y = 0): ItemNode {
  return {
    id,
    name: id,
    tags: [],
    is_raw_material: null,
    slots: [],
    position: { x, y },
  };
}

// 该工厂方法固定使用生产流向 source -> target，语义上表示原料或中间产物进入下游产物。
function edge(
  source: string,
  target: string,
  edgeType: FlowEdge['edge_type'] = 'input',
): FlowEdge {
  return {
    id: `${source}-${target}-${edgeType}`,
    source,
    target,
    target_slot_id: '',
    quantity: 1,
    edge_type: edgeType,
  };
}

// 该辅助函数把布局结果转成按节点 ID 读取的位置表，测试只断言相对层级而不绑定具体像素常量。
function layout(direction: LayoutDirection) {
  return calculateSugiyamaLayout({
    direction,
    nodes: [node('ore'), node('ingot'), node('plate'), node('circuit')],
    edges: [
      edge('ore', 'ingot'),
      edge('ingot', 'plate'),
      edge('plate', 'circuit'),
    ],
  });
}

describe('calculateSugiyamaLayout', () => {
  test('LR 方向以原料为左侧根节点并向右延伸产物', () => {
    const positions = layout('LR');

    expect(positions.get('ore')!.x).toBeLessThan(positions.get('ingot')!.x);
    expect(positions.get('ingot')!.x).toBeLessThan(positions.get('plate')!.x);
    expect(positions.get('plate')!.x).toBeLessThan(positions.get('circuit')!.x);
  });

  test('TB 与 BT 方向复用同一生产层级但采用相反的纵向映射', () => {
    const topToBottom = layout('TB');
    const bottomToTop = layout('BT');

    expect(topToBottom.get('ore')!.y).toBeLessThan(topToBottom.get('circuit')!.y);
    expect(bottomToTop.get('ore')!.y).toBeGreaterThan(bottomToTop.get('circuit')!.y);
  });

  test('副产物默认与产生它的配方节点保持同层，并继续向下游传播层级', () => {
    const positions = calculateSugiyamaLayout({
      direction: 'LR',
      nodes: [node('ore'), node('ingot'), node('slag'), node('brick')],
      edges: [
        edge('ore', 'ingot'),
        edge('ingot', 'slag', 'byproduct'),
        edge('slag', 'brick'),
      ],
    });

    expect(positions.get('ingot')!.x).toBe(positions.get('slag')!.x);
    expect(positions.get('slag')!.x).toBeLessThan(positions.get('brick')!.x);
  });
});
