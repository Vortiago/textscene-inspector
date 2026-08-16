/**
 * The INT-slot refusal, shared by every combinator that reads one.
 *
 * `parseGodotInt` returns `null` for text the tokenizer cannot read and `NaN`
 * for a literal that reads but the slot cannot hold. Only the first was ever
 * gated, and NaN fails every comparison, so 308 of 542 int slots said nothing.
 */

import type { ParseError } from '../types.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';
import { propertyError } from './propertyError.js';
import { parseGodotInt, toUint32 } from '../../godot/index.js';

/**
 * `_to_int<T>` (`variant.h:360-377`) — the conversion every int slot's write
 * goes through, and the authority for refusing a literal it cannot carry.
 */
const INT_SLOT_CITE = 'variant.h:360-377';

/**
 * Error for a value that read but cannot be stored; `null` for a usable number.
 *
 * Never names the result. The FLOAT branch (`variant.h:369-370`) is undefined
 * behaviour and architecture-specific — measured on 4.6.3 x86_64, `light_mask =
 * 3e9` stores -2147483648 where the INT literal `3000000000` stores
 * -1294967296 — so the ALTERATION is the portable claim and the message quotes
 * the literal instead.
 */
export function unrepresentableInt(
  propertyName: string,
  key: string,
  value: string,
  line: number,
  errorCodeValue: string,
  num: number | null
): ParseError | null {
  if (num === null || !Number.isNaN(num)) return null;
  return propertyError(
    key,
    line,
    `Property '${propertyName}' cannot be stored in an integer slot, got: "${value}". ` +
      `The file loads, but the value Godot stores is not the one the file states.`,
    errorCodeValue,
    'error'
  );
}

/** Above this a bound can only be describing a `uint32_t` slot. */
const INT32_MAX = 2147483647;

/**
 * The literal as THIS slot stores it, given the slot's own ceiling.
 *
 * `parseGodotInt` gives the int32 reading, which is what almost every setter
 * takes. A `uint32_t` one is told apart by its own declared maximum: a ceiling
 * above int32 is unreachable unless the slot is unsigned, so the width is
 * derived rather than asked of 50-odd call sites. Measured on 4.6.3, the two
 * genuinely disagree — `MeshInstance3D.layers = 4294967295` stores 4294967295
 * (uint32) where `Node2D.light_mask = 4294967295` stores -1 (int32) — so
 * reading every slot as int32 would refuse a `seed` of UINT32_MAX that Godot's
 * own PROPERTY_HINT_RANGE names as the ceiling.
 */
export function storedInSlot(value: string, max: number | null | undefined): number | null {
  const stored = parseGodotInt(value);
  if (stored === null || Number.isNaN(stored)) return stored;
  return max !== null && max !== undefined && max > INT32_MAX ? toUint32(stored) : stored;
}

/**
 * Tag a validator as reading an INT slot.
 *
 * Two jobs. It clears `formatOnly`, which an int slot can never be: `inf` READS
 * (`variant_parser.cpp:701-707`) and is then altered on the write, so the
 * refusal is of a real value and owes a citation.
 *
 * And it is the population `nonFiniteInts.test.ts` sweeps. Derived from the tag
 * rather than from the `accepts` prose, which missed all 50 layer masks:
 * `layerBitmask` overwrites the tag with `32-bit layer mask (layers 1-32)`,
 * matching neither `integer` nor `bit mask`.
 *
 * It deliberately does NOT set `grounding`. That tag answers a different
 * question — where a BOUND's authority comes from — and filling it here let a
 * bounded int combinator with no citation satisfy `boundGrounding`'s ratchet
 * for free. `validatorClassification` accepts `intSlot` as classification only
 * for a validator carrying no bounds.
 */
export function markIntSlot<T extends PropertyValidator>(validator: T): T {
  delete validator.formatOnly;
  validator.intSlot = { cite: INT_SLOT_CITE };
  return validator;
}
