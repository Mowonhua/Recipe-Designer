import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useStore } from '../store';
import type { ItemNode, Machine } from '../store';

describe('tag pool rebuild', () => {
  beforeEach(() => {
    // 每个用例使用独立的 Pinia 实例，避免 store 深度监听和历史状态在测试之间相互污染。
    setActivePinia(createPinia());
  });

  it('按物品、配方和机器三个来源分别重建标签池，并在池内去重', () => {
    // 构造覆盖三类标签来源的数据：物品标签来自节点属性，配方标签来自配方槽，机器标签只来自机器自身标签。
    const nodes: ItemNode[] = [
      {
        id: 'ore',
        name: 'Iron Ore',
        tags: ['ore', ' raw ', 'ore'],
        is_raw_material: true,
        slots: [],
        position: { x: 0, y: 0 },
      },
      {
        id: 'ingot',
        name: 'Iron Ingot',
        tags: ['metal'],
        is_raw_material: false,
        active_slot_id: 'smelt',
        slots: [{
          id: 'smelt',
          name: 'Smelting',
          time: 1,
          machine_id: 'furnace',
          tags: ['smelting', ' thermal ', 'smelting'],
          primary_output_quantity: 1,
          secondary_outputs: [],
          catalyst_mode: 'none',
        }],
        position: { x: 100, y: 0 },
      },
    ];
    const machines: Machine[] = [{
      id: 'furnace',
      name: 'Furnace',
      base_speed: 1,
      tags: ['thermal', 'basic', 'basic'],
      allowed_recipe_tags: ['smelting', 'casting'],
    }];

    const store = useStore();
    store.seedData({ nodes, edges: [], machines });

    // 标签池只在各自来源内去重；机器允许配方标签属于配方池，不应污染机器标签池。
    expect(store.tag_pool).toEqual({
      item_tags: ['metal', 'ore', 'raw'],
      recipe_tags: ['casting', 'smelting', 'thermal'],
      machine_tags: ['basic', 'thermal'],
    });
  });
});
