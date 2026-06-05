import { describe, expect, it } from 'vitest';
import { buildTagOptions, buildTagOptionsWithCurrent, normalizeTagList } from '../utils/tags';

describe('tag option helpers', () => {
  it('构造可新建标签的下拉选项时只使用已入池标签', () => {
    // 当前编辑值由 NSelect 的 tag 模式负责显示；若把临时值也放入 options，会和组件内部临时选项形成重复项。
    const options = buildTagOptions(['ore', ' metal ']);

    expect(options).toEqual([
      { label: 'metal', value: 'metal' },
      { label: 'ore', value: 'ore' },
    ]);
  });

  it('保存标签前会去除空白、去重并稳定排序', () => {
    // 保存语义独立于下拉显示语义，确保不同入口写入池前都采用同一套规范化规则。
    expect(normalizeTagList([' ore ', '', 'metal', 'ore'])).toEqual(['metal', 'ore']);
  });

  it('普通单选选项可以显式合并当前已选值', () => {
    // 非 tag 模式不会生成临时选项，因此旧数据里的当前值需要由调用方显式合并进下拉选项。
    expect(buildTagOptionsWithCurrent(['ore'], ['fresh'])).toEqual([
      { label: 'fresh', value: 'fresh' },
      { label: 'ore', value: 'ore' },
    ]);
  });
});
