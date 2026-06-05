import { describe, expect, it } from 'vitest';
import { Position } from '@vue-flow/core';
import {
  getCenteredHandleStyle,
  getSlotHandleStyle,
  getTargetBarStyle,
} from '../layout/handle-position';

describe('handle-position helpers', () => {
  it('居中端口只调整边缘偏移，不写入 transform 或 margin 二次补偿', () => {
    const style = getCenteredHandleStyle(Position.Right, '-8px', 16);

    expect(style).toEqual(expect.objectContaining({
      right: '-8px',
      top: '50%',
      width: '16px',
      height: '16px',
    }));
    expect(style).not.toHaveProperty('transform');
    expect(style).not.toHaveProperty('marginTop');
    expect(style).not.toHaveProperty('marginLeft');
  });

  it('LR 入线槽位端口固定在左侧边缘，不覆盖整行中心', () => {
    const style = getSlotHandleStyle(Position.Left);

    expect(style).toEqual(expect.objectContaining({
      left: '-4px',
      top: '50%',
      width: '8px',
      height: '24px',
      marginTop: '-12px',
    }));
    expect(style).not.toHaveProperty('transform');
  });

  it('LR 折叠态目标提示条移动到左侧', () => {
    expect(getTargetBarStyle(Position.Left)).toEqual(expect.objectContaining({
      left: '-4px',
      top: '20%',
      bottom: '20%',
      width: '8px',
    }));
  });
});
