/**
 * Reading a property literal whose spelling and whose SLOT disagree about type,
 * within the BOOL/INT/FLOAT family.
 *
 * `Variant::can_convert_strict` lists INT and FLOAT as valid sources for a BOOL
 * target, and BOOL as a valid source for both numeric targets
 * (`variant.cpp:550-583`). The write casts rather than refusing, so all six
 * cross-spellings are values Godot stores — `visible = 0` hides a node exactly
 * as `visible = false` does.
 *
 * STRING is deliberately absent. Its rows are commented OUT of those three
 * lists, so a string is the one neighbouring spelling the family does not
 * convert, and a diagnostic about `visible = "yes"` stands.
 *
 * Every reader of a boolean property must go through here — the linter's
 * validators, its semantic rules, and the lenient parsers the renderer feeds.
 * A raw `=== 'true'` fails OPEN (the rule silently stops firing) and a raw
 * `!== 'false'` fails CLOSED (the previewer draws a node Godot hides), so the
 * two spellings of the bug are invisible in opposite directions.
 */

import { parseGodotFloat } from './number.js';

/**
 * What a BOOL slot stores for `text`, or `undefined` when the slot does not
 * convert that spelling.
 *
 * The numeric arm is `Variant::booleanize`, which is `!is_zero()`
 * (`variant_op.cpp:1120-1122`) — a membership test against 0, not against 1, so
 * `2` and `-1` and `2.7` are all true. `nan` is true for the same reason: it
 * compares unequal to zero.
 *
 * An ABSENT property is `undefined` rather than false, so a caller keeps the
 * three-way answer the raw text comparisons had: `=== true`, `=== false` and
 * "the key is not set" stay distinguishable, and a defaulted-true property
 * reads `!== false`.
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
 * The number a BOOL literal reads as in an INT or FLOAT slot, or `undefined`
 * for any other spelling — which the caller's own number grammar then reads.
 *
 * `_to_int` and `_to_float` both map BOOL to 1/0 (`variant.h:361-377`), so this
 * feeds the slot's existing bounds rather than short-circuiting them:
 * `z_index = true` is 1, and still judged against `z_index`'s range.
 */
export function boolLiteralAsNumber(text: string): 1 | 0 | undefined {
  const trimmed = text.trim();
  if (trimmed === 'true') return 1;
  if (trimmed === 'false') return 0;
  return undefined;
}
