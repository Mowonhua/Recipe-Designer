import type { State, RecipeSlot } from '../store';
import type { MultiplierSet } from './types';

export function computeMultipliers(
  state: State,
  slot: RecipeSlot,
  machineBoost: number = 1,
): MultiplierSet {
  const machine = state.machines.find(m => m.id === slot.machine_id);
  if (!machine) return { yieldMultiplier: 1, speedMultiplier: 1 };

  // recipe_yield: additive stacking, match slot.tags ∪ machine.tags ∩ effect.target_tags
  const allTags = new Set([...slot.tags, ...machine.tags]);
  let yieldAdditive = 0;
  for (const effect of state.global_effects) {
    if (effect.enabled === false) continue;
    if (effect.type === 'recipe_yield' && effect.target_tags.some(t => allTags.has(t))) {
      yieldAdditive += effect.multiplier - 1;
    }
  }
  // Node machine boost * (1 + additive yield from global effects)
  const yieldMultiplier = machineBoost * (1 + yieldAdditive);

  // machine_speed: additive stacking, match machine.tags ∩ effect.target_tags
  const machineTags = new Set(machine.tags);
  let speedAdditive = 0;
  for (const effect of state.global_effects) {
    if (effect.enabled === false) continue;
    if (effect.type === 'machine_speed' && effect.target_tags.some(t => machineTags.has(t))) {
      speedAdditive += effect.multiplier - 1;
    }
  }
  let speedMultiplier = machine.base_speed * (1 + speedAdditive);

  // Catalyst speed multiplier
  if (slot.catalyst && slot.catalyst.speed_multiplier) {
    speedMultiplier *= slot.catalyst.speed_multiplier;
  }

  return { yieldMultiplier, speedMultiplier };
}
