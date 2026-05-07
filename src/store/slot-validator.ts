// src/store/slot-validator.ts — Pure machine-slot validation functions
//
// Validation Rules:
//   V1-V8: Machine-Recipe match (triggered when node switches machine / modifies recipe / modifies machine slots)
//   V9-V10: Machine self-validation (triggered when saving a machine via drawer)
//
// Design: Pure functions only — no store access, no side effects. Each rule is separately
// exported AND included in the bulk validators.

import type { Machine, MachineSlot, RecipeSlot } from './index';

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export interface SlotValidationError {
  code: string; // e.g. 'V1', 'V2', ...
  message: string; // Human-readable description
  slotType?: string; // Which slot type is involved
  slotIndex?: number; // Which slot index is involved
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise slots to an always-defined array. */
function slotsOf(machine: Machine): MachineSlot[] {
  return machine.slots ?? [];
}

/** Count slots of a given type. */
function slotCount(machine: Machine, type: MachineSlot['type']): number {
  return slotsOf(machine).filter(s => s.type === type).length;
}

/** Return all slots of a given type sorted by index ascending. */
function slotsByType(machine: Machine, type: MachineSlot['type']): MachineSlot[] {
  return slotsOf(machine)
    .filter(s => s.type === type)
    .sort((a, b) => a.index - b.index);
}

/** Find a single slot by type + index. */
function findSlot(machine: Machine, type: string, index: number): MachineSlot | undefined {
  return slotsOf(machine).find(s => s.type === type && s.index === index);
}

// ===================================================================
// V1 – Input slot count
// ===================================================================

/**
 * Validate that the machine has enough input slots for the recipe's input count.
 *
 * @returns An array with a V1 error when the machine has fewer input slots than needed,
 *          or an empty array when valid.
 */
export function validateInputSlotCount(machine: Machine, inputCount: number): SlotValidationError[] {
  if (inputCount <= 0) return [];

  const available = slotCount(machine, 'input');
  if (available < inputCount) {
    return [
      {
        code: 'V1',
        message: `Recipe requires ${inputCount} input slot(s), but machine only has ${available}`,
        slotType: 'input',
      },
    ];
  }
  return [];
}

// ===================================================================
// V2 – Output slot count
// ===================================================================

/**
 * Validate that the machine has enough output slots.
 *
 * @param outputCount  Total number of outputs (1 primary + N secondary).
 * @returns An array with a V2 error when output slots are insufficient.
 */
export function validateOutputSlotCount(machine: Machine, outputCount: number): SlotValidationError[] {
  if (outputCount <= 0) return [];

  const available = slotCount(machine, 'output');
  if (available < outputCount) {
    return [
      {
        code: 'V2',
        message: `Recipe requires ${outputCount} output slot(s), but machine only has ${available}`,
        slotType: 'output',
      },
    ];
  }
  return [];
}

// ===================================================================
// V3 – Catalyst slot
// ===================================================================

/**
 * Validate that the machine has at least one catalyst slot when the recipe
 * uses a catalyst.
 */
export function validateCatalystSlot(machine: Machine, hasCatalyst: boolean): SlotValidationError[] {
  if (!hasCatalyst) return [];

  const available = slotCount(machine, 'catalyst');
  if (available < 1) {
    return [
      {
        code: 'V3',
        message: 'Recipe requires a catalyst slot, but machine has none',
        slotType: 'catalyst',
      },
    ];
  }
  return [];
}

// ===================================================================
// V4 – Proliferator slot
// ===================================================================

/**
 * Validate that the machine has at least one proliferator slot when the recipe
 * has proliferator demand.
 */
export function validateProliferatorSlot(machine: Machine, hasProliferator: boolean): SlotValidationError[] {
  if (!hasProliferator) return [];

  const available = slotCount(machine, 'proliferator');
  if (available < 1) {
    return [
      {
        code: 'V4',
        message: 'Recipe requires a proliferator slot, but machine has none',
        slotType: 'proliferator',
      },
    ];
  }
  return [];
}

// ===================================================================
// V5 – Slot capacities
// ===================================================================

/**
 * Validate that each input item's quantity does not exceed the capacity of its
 * assigned machine input slot.
 *
 * Matching logic:
 *  - If the input item specifies a `slot_index`, look up that exact slot.
 *  - Otherwise, map the nth input item to the nth input slot (by sorted index).
 */
export function validateSlotCapacities(
  machine: Machine,
  inputs: { item_id: string; quantity: number; slot_index?: number }[],
): SlotValidationError[] {
  const errors: SlotValidationError[] = [];
  if (inputs.length === 0) return errors;

  const inputSlots = slotsByType(machine, 'input');

  inputs.forEach((item, position) => {
    let slot: MachineSlot | undefined;

    if (item.slot_index !== undefined) {
      slot = inputSlots.find(s => s.index === item.slot_index);
      if (!slot) {
        // The slot_index itself is out of range — V6 handles that separately,
        // so we only report a capacity error when the slot actually exists.
        return;
      }
    } else {
      slot = inputSlots[position];
      if (!slot) return; // No corresponding slot at this position
    }

    if (item.quantity > slot.capacity) {
      errors.push({
        code: 'V5',
        message: `Input item quantity ${item.quantity} exceeds slot capacity ${slot.capacity} (slot type=input, index=${slot.index})`,
        slotType: 'input',
        slotIndex: slot.index,
      });
    }
  });

  return errors;
}

// ===================================================================
// V6 – Slot index range
// ===================================================================

/**
 * Validate that a `slotIndex` falls within the valid range for a given slot type
 * on the machine.
 *
 * Valid indices for a slot type are 0 .. (countOfType - 1).
 */
export function validateSlotIndexRange(
  machine: Machine,
  slotIndex: number,
  slotType: string,
): SlotValidationError[] {
  const slots = slotsByType(machine, slotType as MachineSlot['type']);
  const maxIndex = slots.length - 1;

  if (slotIndex < 0 || slotIndex > maxIndex) {
    return [
      {
        code: 'V6',
        message: `Slot index ${slotIndex} is out of range for type "${slotType}" (valid range: 0–${maxIndex >= 0 ? maxIndex : 'none'})`,
        slotType,
        slotIndex,
      },
    ];
  }

  // Also warn when the slot type exists but has no slots at all (maxIndex === -1)
  if (slots.length === 0) {
    return [
      {
        code: 'V6',
        message: `Machine has no slots of type "${slotType}", cannot assign slot index ${slotIndex}`,
        slotType,
        slotIndex,
      },
    ];
  }

  return [];
}

// ===================================================================
// V7 – Duplicate slot_index (cross-input / cross-output)
// ===================================================================

/**
 * Check that no two items with *different* item_ids are assigned to the same
 * `slot_index` within the same slot type.
 *
 * This is a bulk check — it is called from {@link validateMachineRecipeMatch}
 * for both input items and output items.
 */
export function validateSlotIndexUniqueness(
  items: { item_id: string; slot_index?: number }[],
  slotType: MachineSlot['type'],
): SlotValidationError[] {
  const errors: SlotValidationError[] = [];

  // Collect only items with an explicit slot_index
  const grouped = new Map<number, string[]>(); // slotIndex -> item_ids[]
  for (const item of items) {
    if (item.slot_index === undefined) continue;
    const list = grouped.get(item.slot_index) || [];
    list.push(item.item_id);
    grouped.set(item.slot_index, list);
  }

  for (const [slotIndex, itemIds] of grouped) {
    const unique = [...new Set(itemIds)];
    if (unique.length > 1) {
      errors.push({
        code: 'V7',
        message: `Multiple different items assigned to the same slot index ${slotIndex} (type=${slotType}): ${unique.join(', ')}`,
        slotType,
        slotIndex,
      });
    }
  }

  return errors;
}

// ===================================================================
// V8 – Slot tag lock
// ===================================================================

/**
 * Validate that an item's tag matches the machine slot's `locked_item_tag`,
 * if one is set.
 *
 * @param itemTag  The tag of the item being assigned to the slot. Pass an empty
 *                 string when the item has no tag.
 */
export function validateSlotTagLock(
  machine: Machine,
  slotIndex: number,
  slotType: string,
  itemTag: string,
): SlotValidationError[] {
  const slot = findSlot(machine, slotType, slotIndex);
  if (!slot) {
    // Slot doesn't exist — index range error handled by V6
    return [];
  }

  if (slot.locked_item_tag && slot.locked_item_tag !== itemTag) {
    return [
      {
        code: 'V8',
        message: `Item tag "${itemTag || '(none)'}" does not match slot locked tag "${slot.locked_item_tag}" (type=${slotType}, index=${slotIndex})`,
        slotType,
        slotIndex,
      },
    ];
  }

  return [];
}

// ===================================================================
// V9 – Machine output slots (exactly one is_main_output)
// ===================================================================

/**
 * Validate a machine's output slot configuration:
 *  - At least one output slot must exist.
 *  - Exactly one output slot must be marked as `is_main_output`.
 */
export function validateMachineOutputSlots(machine: Machine): SlotValidationError[] {
  const errors: SlotValidationError[] = [];
  const outputSlots = slotsOf(machine).filter(s => s.type === 'output');

  if (outputSlots.length === 0) {
    errors.push({
      code: 'V9',
      message: 'Machine must have at least one output slot',
      slotType: 'output',
    });
    return errors;
  }

  const mainSlots = outputSlots.filter(s => s.is_main_output === true);

  if (mainSlots.length === 0) {
    errors.push({
      code: 'V9',
      message: 'Machine must have exactly one main output slot, but none is marked',
      slotType: 'output',
    });
  } else if (mainSlots.length > 1) {
    errors.push({
      code: 'V9',
      message: `Machine must have exactly one main output slot, but ${mainSlots.length} are marked`,
      slotType: 'output',
    });
  }

  return errors;
}

// ===================================================================
// V10 – Consecutive slot indices per type
// ===================================================================

/**
 * Validate that within each slot type, indices form a consecutive sequence
 * starting from 0 (0, 1, 2, …) with no gaps or duplicates.
 */
export function validateMachineSlotIndices(machine: Machine): SlotValidationError[] {
  const errors: SlotValidationError[] = [];
  const types: MachineSlot['type'][] = ['input', 'output', 'catalyst', 'proliferator'];

  for (const type of types) {
    const slots = slotsByType(machine, type);
    if (slots.length === 0) continue;

    const indices = slots.map(s => s.index);

    // Check for duplicates
    const seen = new Set<number>();
    for (const idx of indices) {
      if (seen.has(idx)) {
        errors.push({
          code: 'V10',
          message: `Duplicate slot index ${idx} for type "${type}"`,
          slotType: type,
          slotIndex: idx,
        });
      }
      seen.add(idx);
    }

    // Check consecutive starting from 0
    const expectedMax = slots.length - 1;
    for (let i = 0; i <= expectedMax; i++) {
      if (!seen.has(i)) {
        errors.push({
          code: 'V10',
          message: `Missing slot index ${i} for type "${type}" (indices must be consecutive from 0)`,
          slotType: type,
          slotIndex: i,
        });
      }
    }

    // Check for indices beyond the expected range (stale indices after deletion)
    for (const idx of indices) {
      if (idx > expectedMax) {
        errors.push({
          code: 'V10',
          message: `Slot index ${idx} for type "${type}" exceeds expected max ${expectedMax}`,
          slotType: type,
          slotIndex: idx,
        });
      }
    }
  }

  return errors;
}

// ===================================================================
// Bulk validators
// ===================================================================

/**
 * Run all machine-recipe match validations (V1–V8).
 *
 * @param machine     The machine assigned to the recipe.
 * @param recipe      The recipe slot being validated.
 * @param inputItems  The input items flowing into the recipe (from edges).
 * @returns An array of all validation errors found.
 */
export function validateMachineRecipeMatch(
  machine: Machine,
  recipe: RecipeSlot,
  inputItems: { item_id: string; quantity: number; slot_index?: number }[],
): SlotValidationError[] {
  const errors: SlotValidationError[] = [];

  // V1 – Input slot count
  errors.push(...validateInputSlotCount(machine, inputItems.length));

  // V2 – Output slot count  (1 primary + N secondary)
  const outputCount = 1 + recipe.secondary_outputs.length;
  errors.push(...validateOutputSlotCount(machine, outputCount));

  // V3 – Catalyst slot
  const hasCatalyst = recipe.catalyst_mode !== 'none' || recipe.catalyst !== undefined;
  errors.push(...validateCatalystSlot(machine, hasCatalyst));

  // V4 – Proliferator slot
  // RecipeSlot does not yet have an explicit proliferator-demand field;
  // when it is added the condition here should derive hasProliferator from it.
  const hasProliferator = false;
  errors.push(...validateProliferatorSlot(machine, hasProliferator));

  // V5 – Input slot capacities
  errors.push(...validateSlotCapacities(machine, inputItems));

  // V6 – Slot index range for each input item that specifies slot_index
  for (const item of inputItems) {
    if (item.slot_index !== undefined) {
      errors.push(...validateSlotIndexRange(machine, item.slot_index, 'input'));
    }
  }

  // V6 – Slot index range for each secondary output that specifies slot_index
  for (const so of recipe.secondary_outputs) {
    if (so.slot_index !== undefined) {
      errors.push(...validateSlotIndexRange(machine, so.slot_index, 'output'));
    }
  }

  // V7 – Cross-input slot_index uniqueness
  errors.push(...validateSlotIndexUniqueness(inputItems, 'input'));

  // V7 – Cross-output slot_index uniqueness (secondary outputs)
  errors.push(...validateSlotIndexUniqueness(recipe.secondary_outputs, 'output'));

  // V8 – Slot tag lock (inputs)
  // Input items carry their tag via the source node, but that information is not
  // available in this pure-function context. The caller may invoke
  // validateSlotTagLock individually for each input once the item tag is known.
  // No bulk V8 is run here.

  return errors;
}

/**
 * Run all machine self-validations (V9–V10).
 *
 * @param machine  The machine definition to validate.
 * @returns An array of all validation errors found.
 */
export function validateMachineSelf(machine: Machine): SlotValidationError[] {
  const errors: SlotValidationError[] = [];

  // V9 – Output slot main-output marker
  errors.push(...validateMachineOutputSlots(machine));

  // V10 – Consecutive slot indices
  errors.push(...validateMachineSlotIndices(machine));

  return errors;
}
