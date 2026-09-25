/**
 * The number grammar Godot's own tokenizer reads (`variant_parser.cpp`). The render
 * decoders use the finite grammar and the linter a widened one derived from it, so the two
 * cannot drift. {@link TSCN_FLOAT_PATTERN_SOURCE} says why they differ.
 */

import { compositeSpellings } from './variantConversion.js';

/**
 * One finite float component, transcribed from `get_token` (`variant_parser.cpp:420-481`).
 * Anchored and finite by choice: it refuses `inf` and `nan`, so a decoder falls back to its
 * default. `number.md` gives each clause with its source line, measured load and ReDoS reason.
 */
export const FLOAT_PATTERN_SOURCE = String.raw`-?\d+(?:\.\d*)?(?:[eE][-+]?\d*)?`;

/**
 * The anchored form, for a whole string that must be one finite number. Here, because
 * `godotLiteralGrammar.guard` refuses a scalar grammar outside this directory. The header's
 * `format=` reads it, a Variant number into an `int` (`resource_format_text.cpp:1140`).
 * `1e999` still overflows, so a caller that must not see an infinity tests the result.
 */
export const FLOAT_RE = new RegExp(`^${FLOAT_PATTERN_SOURCE}$`);

/**
 * The anchored regex for a fixed-arity composite in the finite grammar, one capture per
 * component. A hand-rolled `(-?[\d.eE+-]+)` accepts `e+-.`, so `godotLiteralGrammar.guard.test.ts`
 * keeps composite grammars here and in the linter's `makeFloatTupleRegex`. `Vector2i(2e1, 0)`
 * loads as `(20, 0)` (`variant_parser.cpp:577-592`), so read `i` captures with `storedInt`.
 */
function tupleRegex(typeName: string, arity: number, convertible: boolean): RegExp {
  const component = `(${FLOAT_PATTERN_SOURCE})`;
  const body = Array.from({ length: arity }, () => component).join(String.raw`\s*,\s*`);
  const name = convertible ? compositeSpellings(typeName) : typeName;
  return new RegExp(String.raw`^${name}\s*\(\s*${body}\s*\)$`);
}

/**
 * The grammar for a composite in a property slot of `typeName`. It accepts every spelling
 * `can_convert_strict` converts into that type, because the write goes through
 * `VariantCaster<T>::cast` (`binder_common.h:223`): `SubViewport.size = Vector2(1920, 1080)`
 * is a file Godot opens.
 */
export function slotTupleRegex(typeName: string, arity: number): RegExp {
  return tupleRegex(typeName, arity, true);
}

/**
 * The grammar for a composite in a Variant position, stored as the type the file spells.
 * An animation keyframe keeps the Variant, so the slot grammar would truncate a `Vector3`
 * rotation key to whole degrees. Two named functions, no default: they differ for eight
 * type names, and a call site does not show which one it reads.
 */
export function variantTupleRegex(typeName: string, arity: number): RegExp {
  return tupleRegex(typeName, arity, false);
}

/**
 * The float spellings Godot reads (`variant_parser.cpp:150-155` string form, `:701-706` token
 * form) and writes back, which `parseFloat` reads as NaN. Non-finite is not a defect: a setter
 * that refuses it (`ERR_FAIL_COND(!is_finite(...))`) says so with the `finite` grounding.
 */
const NON_FINITE_FLOATS: Readonly<Record<string, number>> = {
  inf: Infinity,
  '-inf': -Infinity,
  inf_neg: -Infinity,
  nan: NaN,
};

/**
 * One float component as Godot's tokenizer reads it: the finite grammar plus the spellings
 * of {@link NON_FINITE_FLOATS}, longest first, for the linter (`variant_parser.cpp:552-596`).
 * No capture group. `number.md` gives the `rtos_fix` writer lines and why the match stays linear.
 */
export const TSCN_FLOAT_PATTERN_SOURCE = `(?:${Object.keys(NON_FINITE_FLOATS)
  .sort((a, b) => b.length - a.length)
  .join('|')}|${FLOAT_PATTERN_SOURCE})`;

/**
 * One float literal, anchored, for packed-array elements checked one at a time. No `g`
 * flag, so `.test()` on this shared instance is stateless.
 */
export const TSCN_FLOAT_RE = new RegExp(`^${TSCN_FLOAT_PATTERN_SOURCE}$`);

/**
 * A TSCN float literal as a number, or `null` when the text is not one. `null`, not NaN,
 * because `nan` is a legal value.
 */
export function parseGodotFloat(value: string): number | null {
  const trimmed = value.trim();
  if (Object.prototype.hasOwnProperty.call(NON_FINITE_FLOATS, trimmed)) {
    return NON_FINITE_FLOATS[trimmed]!;
  }
  // `parseFloat` reads `75abc` as 75. Godot stops the number at `a` (variant_parser.cpp:450)
  // and glues the rest onto the next assignment's name (:1948). The grammar, not a finiteness
  // test, refuses JavaScript's `Infinity`, since `1e999` is a legal literal that overflows
  // in Godot too.
  if (!TSCN_FLOAT_RE.test(trimmed)) return null;
  const num = parseFloat(trimmed);
  return Number.isNaN(num) ? null : num;
}

/**
 * One component the finite grammar already matched: the float twin of `storedInt`. Named, so
 * `godotLiteralGrammar.guard.test.ts` bans a raw `parseFloat` on unvetted text. Use
 * {@link parseGodotFloat} for anything else. A caller feeding three.js checks with
 * {@link allFinite}.
 */
export function matchedFloat(capture: string): number {
  return parseFloat(capture);
}

/**
 * Whether every component of a matched composite is finite. `Vector2(1e999, 0)` matches the
 * finite grammar and reads as `Infinity`, which three.js renders as NaN geometry, so a render
 * decoder falls back here as for a refused literal.
 */
export function allFinite(values: readonly number[]): boolean {
  return values.every((value) => Number.isFinite(value));
}
