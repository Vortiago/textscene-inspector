/**
 * The value side of a deprecated `_set` arm, whose setter can receive another value than the file
 * carries. Raw text in and out: `resolveDeprecatedProperty` runs while the scanner builds the
 * property bag, before any decoder or linter rule, so all of them see the value the engine stores.
 */

import { boolSlotValue } from './variantBool.js';
import { parseGodotFloat } from './number.js';
import { literalText, splitTopLevel } from './string.js';
import { compositeTypeName, isConvertedSpelling } from './variantConversion.js';
import { isNilLiteral } from './variantParser.js';

/** A composite literal's constructor body, or `null` when the text is not one. */
const COMPOSITE_BODY_RE = /^\s*[A-Za-z0-9_]+\s*\(([\s\S]*)\)\s*$/;

/**
 * A float as `rtos_fix` (`variant_parser.cpp:1985-1999`) spells it, so every grammar downstream
 * reads the rewrite: a zero of either sign is `0`, and the non-finite spellings are `stor_fix`'s.
 */
function godotFloatText(value: number): string {
  if (Number.isNaN(value)) return 'nan';
  if (value === Infinity) return 'inf';
  if (value === -Infinity) return '-inf';
  if (value === 0) return '0';
  return String(value);
}

/**
 * A `set_size((VectorN)p_value * 2)` arm: the Godot-3 half-extents, doubled into `size`. The cast
 * takes the `i` spelling (`can_convert_strict`) and the setter the float type, so `Vector3i(3, 1, 3)`
 * becomes `Vector3(6, 2, 6)`, and `inf` doubles to `inf`. A refused literal is returned as written
 * under the renamed key, so the slice's decoder warns and uses its default, as for a bad `size`.
 */
export function doubledVector(typeName: 'Vector2' | 'Vector3'): (raw: string) => string {
  const arity = typeName === 'Vector2' ? 2 : 3;
  return (raw) => {
    const spelled = compositeTypeName(raw);
    if (spelled !== typeName && !isConvertedSpelling(typeName, spelled)) return raw;
    const body = COMPOSITE_BODY_RE.exec(raw)?.[1];
    if (body === undefined) return raw;
    const components = splitTopLevel(body).map(parseGodotFloat);
    if (components.length !== arity || components.some((c) => c === null)) return raw;
    return `${typeName}(${components.map((c) => godotFloatText(c! * 2)).join(', ')})`;
  };
}

/**
 * `p_value.operator bool()`, `Variant::booleanize`, which is `!is_zero()` (`variant_op.cpp:1120-1122`).
 * BOOL, INT and FLOAT go through {@link boolSlotValue}, a STRING is zero only when empty, and `null`
 * is the NIL zero. Any other form is `undefined`, which the alias table reads as not forwarded, so
 * no canonical slot is written from a value this did not read.
 */
export function booleanized(raw: string): boolean | undefined {
  const asSlot = boolSlotValue(raw);
  if (asSlot !== undefined) return asSlot;
  const trimmed = raw.trim();
  if (/^[&^]?["']/.test(trimmed)) return literalText(trimmed) !== '';
  if (isNilLiteral(trimmed)) return false;
  return undefined;
}

/** Whether a `_set` arm gated on `bool(p_value)` forwards this literal. */
export function isTruthy(raw: string): boolean {
  return booleanized(raw) === true;
}
