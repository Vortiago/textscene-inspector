/**
 * `Packed<Kind>Array(…)` combinators, all three built on one shared shape.
 */

import type { PropertyValidator } from '../../ValidatorRegistry.js';
import { propertyError } from '../propertyError.js';
import { TSCN_FLOAT_RE } from '../commonValidators.js';
import { formatCode } from './codes.js';
import { shape } from './grounding.js';

/**
 * The first element of an already-extracted array body that Godot's tokenizer
 * could not read, or `null` when every one of them is a number.
 *
 * One grammar for every packed array, int-typed ones included.
 * `PackedInt32Array` is parsed by `_parse_construct<int32_t>`
 * (`variant_parser.cpp:1428-1430`) — the SAME helper as `Vector2i` and as the
 * float arrays, which takes any number token and narrows it on assignment. The
 * five int-array validators that used `IS_VALID_INT_RE` instead reported a
 * format error on `PackedInt32Array(2e3, 0, 0)`, a file Godot opens.
 * `IS_VALID_INT_RE` describes `String::is_valid_int()`, which is the grammar of
 * an index inside a property KEY, not of a Variant literal.
 *
 * Returns the offending text rather than a `ParseError` so each caller keeps
 * its own property name, message wording and error code. Takes the raw body or
 * already-split parts, for the callers that must strip a trailing comma first.
 */
export function firstNonNumericElement(body: string | readonly string[]): string | null {
  for (const part of typeof body === 'string' ? body.split(',') : body) {
    const trimmed = part.trim();
    // The component GRAMMAR, not a numeric parse: `Number()` refuses `inf`,
    // which `rtos_fix` writes into these arrays too (variant_parser.cpp:2504,
    // :2519, :2534), while `parseFloat` would accept the trailing garbage in
    // `1abc` that Godot's tokenizer stops at.
    if (!TSCN_FLOAT_RE.test(trimmed)) return trimmed;
  }
  return null;
}

/**
 * `Packed<Kind>Array(n1, n2, …)` — an arbitrary-length list of fixed-size
 * TUPLES (2 floats per Vector2, 3 per Vector3, 4 per Color), format-only.
 *
 * A count that isn't a multiple of `groupSize` is deliberately NOT rejected:
 * Godot's own `VariantParser::parse_value` builds the typed array with
 * `args.size() / groupSize` (integer division) and drops the remainder
 * (`variant_parser.cpp:1555` Vector2Array, `:1573` Vector3Array, `:1609`
 * ColorArray), so e.g. `PackedVector3Array(0, 0, 1, 0)` loads as a single
 * `Vector3(0, 0, 1)` with no error. Rejecting it refused a file Godot reads.
 *
 * Godot serialises an empty array as `Packed<Kind>Array()`, so zero values is
 * legal.
 *
 * `example` overrides the literal shown in the "must be a …" message; it
 * defaults to `groupSize` zeros (`Vector3(0, 0, 0)`). `PackedVector2Array`'s
 * historical message instead shows two coordinate pairs, so it passes one.
 *
 * `wrapper` is always one of this module's own literal type names
 * (`PackedVector2Array` / `PackedVector3Array` / `PackedColorArray`), never
 * caller-supplied free text, so embedding it directly in a `RegExp` is safe.
 */
function packedTupleArray(
  name: string,
  wrapper: string,
  groupSize: number,
  acceptsLabel: string,
  example: string = Array(groupSize).fill('0').join(', ')
): PropertyValidator {
  const formatErr = formatCode(name);
  const WRAPPER_RE = new RegExp(`^\\s*${wrapper}\\s*\\(([\\s\\S]*)\\)\\s*$`);
  return shape((key, value, line) => {
    const match = WRAPPER_RE.exec(value);
    if (!match) {
      return propertyError(
        key,
        line,
        `Property '${name}' must be a ${wrapper} like ${wrapper}(${example}), got: ${value}`,
        formatErr
      );
    }
    const body = match[1]!.trim();
    if (body === '') return null;

    const offender = firstNonNumericElement(body);
    if (offender !== null) {
      return propertyError(
        key,
        line,
        `Property '${name}' contains a non-numeric value: "${offender}"`,
        formatErr
      );
    }
    return null;
  }, acceptsLabel);
}

export const packedArrayCombinators = {
  /**
   * `PackedVector2Array(x, y, x, y, …)`, an arbitrary-length list of coordinate PAIRS.
   *
   * Not built on `floatTupleValidator`, which pins an exact arity — this is
   * {@link packedTupleArray}, the arbitrary-length combinator shared with
   * `v.packedVector3Array` and `v.packedColorArray`. The `example` argument
   * overrides `packedTupleArray`'s default all-zero example, so the "must be
   * a …" message keeps showing two coordinate pairs, this validator's
   * pre-promotion wording.
   *
   * Godot serialises an empty array as `PackedVector2Array()`, so zero values is legal.
   * Godot writes signed, scientific (`4.37114e-08`), whitespace-padded and
   * non-finite (`inf` / `inf_neg` / `nan`) numbers, all of which `TSCN_FLOAT_RE`
   * accepts. An ODD number of values (a truncated final vertex) is likewise NOT
   * rejected: `VariantParser::parse_value` divides the flat float count by 2 with
   * integer division and drops the remainder (variant_parser.cpp:1555), so a
   * scene carrying one still loads and rejecting it here would refuse a file
   * Godot reads.
   */
  packedVector2Array(name: string): PropertyValidator {
    return packedTupleArray(name, 'PackedVector2Array', 2, 'PackedVector2Array(x, y, …)', '0, 0, 1, 0');
  },

  /**
   * `PackedVector3Array(x, y, z, x, y, z, …)`, an arbitrary-length list of
   * VERTEX triples. See {@link packedTupleArray} for the shared shape and why
   * a non-multiple-of-3 count is accepted rather than refused.
   */
  packedVector3Array(name: string): PropertyValidator {
    return packedTupleArray(name, 'PackedVector3Array', 3, 'PackedVector3Array(x, y, z, …)');
  },

  /**
   * `PackedColorArray(r, g, b, a, r, g, b, a, …)`, an arbitrary-length list of
   * RGBA quadruples. See {@link packedTupleArray} for the shared shape and why
   * a non-multiple-of-4 count is accepted rather than refused.
   */
  packedColorArray(name: string): PropertyValidator {
    return packedTupleArray(name, 'PackedColorArray', 4, 'PackedColorArray(r, g, b, a, …)');
  },
};
