import { Position } from '@vue-flow/core';

// 该函数生成方形端口的边缘偏移样式；居中由 Vue Flow 方向类的默认 transform 负责，避免二次补偿导致偏移。
export function getCenteredHandleStyle(position: Position, offset: string, size: number): Record<string, string> {
  if (position === Position.Left) {
    return { left: offset, top: '50%', right: 'auto', bottom: 'auto', width: `${size}px`, height: `${size}px` };
  }

  if (position === Position.Right) {
    return { right: offset, top: '50%', left: 'auto', bottom: 'auto', width: `${size}px`, height: `${size}px` };
  }

  if (position === Position.Bottom) {
    return { bottom: offset, left: '50%', top: 'auto', right: 'auto', width: `${size}px`, height: `${size}px` };
  }

  return { top: offset, left: '50%', right: 'auto', bottom: 'auto', width: `${size}px`, height: `${size}px` };
}

// 该函数把展开槽位的连接区域限制在当前入线方向的边缘，避免端点落在槽位行中心并被节点遮挡。
export function getSlotHandleStyle(position: Position): Record<string, string> {
  if (position === Position.Left) {
    return { left: '-4px', top: '50%', right: 'auto', bottom: 'auto', width: '8px', height: '24px', marginTop: '-12px' };
  }

  if (position === Position.Right) {
    return { right: '-4px', top: '50%', left: 'auto', bottom: 'auto', width: '8px', height: '24px', marginTop: '-12px' };
  }

  if (position === Position.Top) {
    return { top: '-4px', left: '0', right: '0', bottom: 'auto', width: '100%', height: '8px', marginTop: '0' };
  }

  return { bottom: '-4px', left: '0', right: '0', top: 'auto', width: '100%', height: '8px', marginTop: '0' };
}

// 该函数生成折叠态目标提示条样式，使视觉提示条和真实 target Handle 保持同侧。
export function getTargetBarStyle(position: Position): Record<string, string> {
  if (position === Position.Left) {
    return { left: '-4px', top: '20%', bottom: '20%', right: 'auto', width: '8px', height: 'auto' };
  }

  if (position === Position.Right) {
    return { right: '-4px', top: '20%', bottom: '20%', left: 'auto', width: '8px', height: 'auto' };
  }

  if (position === Position.Top) {
    return { top: '-4px', left: '20%', right: '20%', bottom: 'auto', width: 'auto', height: '8px' };
  }

  return { bottom: '-4px', left: '20%', right: '20%', top: 'auto', width: 'auto', height: '8px' };
}
