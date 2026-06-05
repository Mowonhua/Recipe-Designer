import type { State, RecipeSlot } from '../store';
import type { MultiplierSet } from './types';

export function computeMultipliers(
  state: State,
  slot: RecipeSlot,
  machineBoost: number = 1,
  itemTags: string[] = [],
): MultiplierSet {
  const machine = state.machines.find(m => m.id === slot.machine_id);
  if (!machine) return {
    yieldMultiplier: 1, speedMultiplier: 1,
    proliferatorMultiplier: 1, globalYieldMultiplier: 1, globalSpeedMultiplier: 1,
  };

  // 配方产量效果采用加法叠加；目标标签可以命中当前产物标签、配方槽标签或机器标签。
  const allYieldTags = new Set([...itemTags, ...slot.tags, ...machine.tags]);
  let yieldAdditive = 0;
  for (const effect of state.global_effects) {
    if (effect.enabled === false) continue;
    if (effect.type === 'recipe_yield' && effect.target_tags.some(t => allYieldTags.has(t))) {
      yieldAdditive += effect.multiplier - 1;
    }
  }
  const globalYieldMultiplier = 1 + yieldAdditive;
  const yieldMultiplier = machineBoost * globalYieldMultiplier;

  // 机器速度效果采用加法叠加；该效果只命中机器自身标签，避免物品标签改变机器运行速度。
  const machineTags = new Set(machine.tags);
  let speedAdditive = 0;
  for (const effect of state.global_effects) {
    if (effect.enabled === false) continue;
    if (effect.type === 'machine_speed' && effect.target_tags.some(t => machineTags.has(t))) {
      speedAdditive += effect.multiplier - 1;
    }
  }
  const globalSpeedMultiplier = 1 + speedAdditive;
  let speedMultiplier = machine.base_speed * globalSpeedMultiplier;

  // 催化剂速度倍率在全局机器速度之后继续乘入，保持单个配方槽的局部加速语义。
  if (slot.catalyst && slot.catalyst.speed_multiplier) {
    speedMultiplier *= slot.catalyst.speed_multiplier;
  }

  return { yieldMultiplier, speedMultiplier, proliferatorMultiplier: machineBoost, globalYieldMultiplier, globalSpeedMultiplier };
}
