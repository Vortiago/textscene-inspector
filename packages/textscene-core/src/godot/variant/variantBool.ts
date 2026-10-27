/**
 * Reading a property literal whose spelling and slot disagree about type, within the BOOL/INT/FLOAT family.
 * `Variant::can_convert_strict` (`variant.cpp:550-583`) lists INT and FLOAT as sources for BOOL, and BOOL for both, and the
 * write casts: `visible = 0` hides a node like `visible = false`. STRING rows are commented out, so `visible = "yes"` stays a
 * diagnostic. Every boolean reader goes through here: a raw `=== 'true'` stops a rule firing, and `!== 'false'` draws a node Godot hides.
 */

import { parseGodotFloat } from './number.js';

/**
 * What a BOOL slot stores for `text`, or `undefined` when the slot does not convert that spelling. The numeric arm is
 * `Variant::booleanize`, `!is_zero()` (`variant_op.cpp:1120-1122`), so `2`, `-1`, `2.7` and `nan` are all true.
 * An absent property is `undefined`, not false, so "not set" stays distinct and a defaulted-true property reads `!== false`.
 */
export function boolSlotValue(text: string | undefined): boolean | undefined {
  if (text === undefined) return undefined;
  const trimmed = text.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  const asNumber = parseGodotFloat(trimmed);
  return asNumber === null ? undefined : asNumber !== 0;
}

/**
 * The number a BOOL literal reads as in an INT or FLOAT slot, or `undefined` for any other spelling, which the caller's
 * number grammar then reads. `_to_int` and `_to_float` map BOOL to 1/0 (`variant.h:361-377`), so this feeds the slot's
 * bounds rather than bypass them: `z_index = true` is 1, judged against `z_index`'s range.
 */
export function boolLiteralAsNumber(text: string): 1 | 0 | undefined {
  const trimmed = text.trim();
  if (trimmed === 'true') return 1;
  if (trimmed === 'false') return 0;
  return undefined;
}

/**
 * The double a literal holds in an INT or FLOAT slot, or `null` for text the tokenizer cannot read:
 * the BOOL arm first, then the TSCN float grammar. Every reader of a numeric property starts here.
 * A packed-array element is no property write and reads {@link parseGodotFloat} alone.
 *
 * @oneWay A scalar slot
 */
export function scalarSlotValue(text: string): number | null {
  return boolLiteralAsNumber(text) ?? parseGodotFloat(text);
}

/**
 * {@link scalarSlotValue} of a property as the file writes it: undefined for an absent key and for
 * a value the slot refuses. `inf` and `nan` stay, for a consumer that draws what Godot draws.
 *
 * @oneWay A scalar slot that the consumer draws as `inf` and `nan`, as Godot does
 */
export function writtenScalarSlotValue(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  return scalarSlotValue(value) ?? undefined;
}
