/**
 * The value side of a deprecated `_set` arm: what the setter receives is not
 * always the literal the file carries.
 *
 * Every transform here operates on the RAW literal text and returns raw text,
 * because `canonicalPropertyName` runs while the scanner is still building the
 * property bag — before any typed decoder, and before the linter's rules read
 * the same bag. One rewrite, and parser, linter and renderer all see the value
 * the engine stores.
 */

import { boolSlotValue } from './variantBool.js';
import { parseGodotFloat } from './number.js';
import { literalText, splitTopLevel } from './string.js';
import { compositeTypeName, isConvertedSpelling } from './variantConversion.js';
import { isNilLiteral } from './variantParser.js';

/** A composite literal's constructor body, or `null` when the text is not one. */
const COMPOSITE_BODY_RE = /^\s*[A-Za-z0-9_]+\s*\(([\s\S]*)\)\s*$/;

/**
 * A float as `rtos_fix` (`variant_parser.cpp:1985-1999`) spells it, so the
 * rewritten literal is one Godot's own writer could have produced and every
 * grammar downstream already reads: a zero of either sign is `0`, and the three
 * non-finite spellings are the ones `stor_fix` recognises.
 */
function godotFloatText(value: number): string {
  if (Number.isNaN(value)) return 'nan';
  if (value === Infinity) return 'inf';
  if (value === -Infinity) return '-inf';
  if (value === 0) return '0';
  return String(value);
}

/**
 * A transform for a `set_size((VectorN)p_value * 2)` arm — the Godot-3
 * half-extents, doubled into the modern `size`.
 *
 * The cast accepts the `i`-suffixed spelling too (`Variant::can_convert_strict`
 * lists `Vector3i` for `Vector3`), and the setter takes the float type, so the
 * result is always spelled with the canonical jacket: `Vector3i(3, 1, 3)` comes
 * out as `Vector3(6, 2, 6)`. Each component is read with the same widened
 * grammar the tokenizer applies, so `inf` doubles to `inf`.
 *
 * A literal the grammar refuses — the wrong arity, a component that is not a
 * number — is returned as written. The key is still renamed, so the slice's own
 * decoder answers for it exactly as it does for a malformed `size`: a warning
 * and the documented default.
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
 * `p_value.operator bool()` — `Variant::booleanize`, which is `!is_zero()`
 * (`variant_op.cpp:1120-1122`) — for the spellings a property line carries.
 *
 * BOOL, INT and FLOAT go through {@link boolSlotValue}; a STRING is zero only
 * when empty (`is_zero` compares against `String()`), and `null` is the NIL
 * zero. Every other form — a composite, a resource reference — is left
 * `undefined`, which the alias table reads as "not forwarded": the key stays
 * under its own spelling, and no canonical slot is written from a value this
 * function did not read.
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
