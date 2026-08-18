/**
 * `Packed<Kind>Array(…)` combinators, all three built on one shared shape.
 */

import type { PropertyValidator } from '../../ValidatorRegistry.js';
import { propertyError } from '../propertyError.js';
import { parseGodotFloat, storedFromFloat, TSCN_FLOAT_RE } from '../commonValidators.js';
import type { IntWidth } from '../../../godot/index.js';
import type { ParseError } from '../../types.js';
import { formatCode } from './codes.js';
import { shape } from './grounding.js';

/** What is wrong with one element of a packed INT array, and which element. */
interface BadIntElement {
  /** `unreadable` — the tokenizer refuses it. `unstorable` — it reads, the slot's width cannot hold it. */
  kind: 'unreadable' | 'unstorable';
  text: string;
}

/** A fractional element: it reads and fits, but the conversion drops the fraction. */
interface TruncatedElement {
  text: string;
  /** The int the slot ends up with, already narrowed. */
  stored: number;
}

/**
 * Both verdicts a packed INT body can produce, from ONE walk.
 *
 * They are returned side by side rather than as one winner because their tiers
 * differ and the CALLER decides the order: `error` outranks everything,
 * including the grounded checks a caller runs afterwards, while `truncated` is
 * a warning that must come last. Returning the warning as if it were the single
 * answer silenced `INVALID_DATA_CELLS_COUNT` on a GridMap whose cell stream had
 * a fractional element, and stopped Polygon2D scanning its second entry.
 */
interface IntElementVerdict {
  error: BadIntElement | null;
  truncated: TruncatedElement | null;
}

/**
 * The first element of an already-extracted INT array body that Godot cannot
 * read, or reads and cannot store, or `null` when every one is usable.
 *
 * ONE pass for both questions. Asking them separately meant four call sites
 * split, trimmed and re-matched the same body twice, and `parseGodotInt` runs
 * `TSCN_FLOAT_RE` internally — the same regex the second walk re-ran on every
 * element, of which a stage's GridMap carries ~8,800.
 *
 * `PackedInt32Array` is parsed by `_parse_construct<int32_t>`
 * (`variant_parser.cpp:1428-1430`) — the SAME helper as `Vector2i` and as the
 * float arrays, which takes any number token and narrows it on assignment. The
 * five int-array validators that used `IS_VALID_INT_RE` instead reported a
 * format error on `PackedInt32Array(2e3, 0, 0)`, a file Godot opens.
 * `IS_VALID_INT_RE` describes `String::is_valid_int()`, which is the grammar of
 * an index inside a property KEY, not of a Variant literal.
 *
 * `width` is the ELEMENT's C++ type, and it is not always int32.
 * `PackedByteArray` goes through a helper of its own — `_parse_byte_array`
 * (`variant_parser.cpp:600`) pushing into a `Vector<uint8_t>` (`:650`) — so its
 * elements convert through `Variant::operator uint8_t()`
 * (`variant.cpp:1519-1521`). Read at int32 a byte slot says nothing at all
 * about `300`, `-1` or `1000000000`, each of which Godot alters (to 44, 255
 * and 0).
 *
 * Takes the raw body or already-split parts, for the callers that must strip a
 * trailing comma first.
 */
function scanIntElements(
  body: string | readonly string[],
  width: IntWidth = 'int32'
): IntElementVerdict {
  let truncated: TruncatedElement | null = null;
  for (const part of typeof body === 'string' ? body.split(',') : body) {
    const text = part.trim();
    // `parseGodotFloat` + `storedFromFloat`, which is what `parseGodotInt` does
    // internally — spelled out so the float is in hand for the fractional test
    // below. Calling `parseGodotInt` and then re-parsing added a second
    // `TSCN_FLOAT_RE` run to every element of every CLEAN body, measured at
    // +39% on a real 7,848-element GridMap stream, to detect a condition a
    // clean body by definition does not have.
    const asFloat = parseGodotFloat(text);
    if (asFloat === null) return { error: { kind: 'unreadable', text }, truncated: null };
    const stored = storedFromFloat(asFloat, text, width);
    if (Number.isNaN(stored)) return { error: { kind: 'unstorable', text }, truncated: null };
    if (truncated === null && Number.isFinite(asFloat) && !Number.isInteger(asFloat)) {
      truncated = { text, stored };
    }
  }
  return { error: null, truncated };
}

/**
 * The diagnostic for the first unusable element of a packed INT body, or `null`
 * when every element is usable — so the six call sites do not hand-maintain a
 * copy each. One function, because the finder's result never had another
 * reader: every site fed it straight back in.
 *
 * The CODE carries the distinction the two kinds make: `_FORMAT` means Godot's
 * own parser could not read the element, `_VALUE` means it read a real value
 * the slot then altered. Two sites reported the second under a `_FORMAT` code,
 * which tells a consumer the opposite of what happened.
 *
 * `width` is the element's C++ type; see {@link scanIntElements}. It also names
 * the thing the value did not fit, since `300` is an integer and is not a byte.
 */
export function badIntElement(
  propertyName: string,
  key: string,
  line: number,
  body: string | readonly string[],
  codes: { format: string; value: string },
  width: IntWidth = 'int32'
): { error: ParseError | null; truncated: ParseError | null } {
  const { error, truncated } = scanIntElements(body, width);
  const holder = width === 'uint8' ? 'byte' : 'integer';
  return {
    error:
      error === null
        ? null
        : error.kind === 'unreadable'
          ? propertyError(
              key,
              line,
              `Property '${propertyName}' contains a non-numeric value: "${error.text}"`,
              codes.format
            )
          : propertyError(
              key,
              line,
              `Property '${propertyName}' has an element no ${holder} can hold: "${error.text}"`,
              codes.value,
              'error'
            ),
    truncated:
      truncated === null
        ? null
        : propertyError(
            key,
            line,
            `Property '${propertyName}' has integer elements, so Godot drops the fractional part of "${truncated.text}" and stores ${truncated.stored}.`,
            codes.value,
            'warning'
          ),
  };
}

/**
 * The first element of an already-extracted FLOAT array body that Godot's
 * tokenizer could not read, or `null` when every one of them is a number.
 *
 * Returns the offending text rather than a `ParseError` so each caller keeps
 * its own property name, message wording and error code.
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

  /**
   * `PackedFloat32Array(a, b, …)` — a FLAT list of scalars, no grouping.
   *
   * `groupSize` is 1 because there is none: it feeds only the default example
   * string, and the body check is element-wise either way. Two slices
   * hand-rolled this validator whole, and the shared element reader is exactly
   * where the packed-array grammar last moved — so the copies were the two
   * places that had to be found and edited by hand.
   *
   * `example` is the one thing the two differed on, and it is preserved rather
   * than normalised: it is the wording each property's message already carries.
   */
  packedFloat32Array(name: string, example: string): PropertyValidator {
    return packedTupleArray(name, 'PackedFloat32Array', 1, 'PackedFloat32Array(x, y, …)', example);
  },
};
