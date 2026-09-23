/**
 * `Packed<Kind>Array(…)` combinators, all three built on one shared shape.
 */

import type { PropertyValidator } from '../../ValidatorRegistry.js';
import { propertyError } from '../propertyError.js';
import { parseGodotFloat, storedFromFloat, TSCN_FLOAT_RE } from '../commonValidators.js';
import {
  packedArrayBody,
  packedArrayForms,
  packedArrayLiteral,
  packedElementType,
  readerLimitedInt,
  splitTopLevel,
  type IntWidth,
} from '../../../godot/index.js';
import { compositeSpellings } from '../../../godot/variantConversion.js';
import type { ParseError } from '../../types.js';
import { formatCode } from './codes.js';
import { shape } from './grounding.js';

/** What is wrong with one element of a packed INT array, and which element. */
interface BadIntElement {
  /**
   * `unreadable`: the tokenizer refuses it. `unstorable`: the slot's C++ type
   * alters it. `beyondReader`: an int64 element past 2^53, which Godot carries
   * intact and this reader's double cannot.
   */
  kind: 'unreadable' | 'unstorable' | 'beyondReader';
  text: string;
}

/** A fractional element: it reads and fits, but the conversion drops the fraction. */
interface TruncatedElement {
  text: string;
  /** The int the slot ends up with, already narrowed. */
  stored: number;
}

/**
 * Both verdicts a packed INT body can produce, from one walk, side by side
 * because the caller decides the order: `error` outranks everything, including
 * the caller's later grounded checks, and the `truncated` warning comes last.
 */
interface IntElementVerdict {
  error: BadIntElement | null;
  truncated: TruncatedElement | null;
}

/**
 * The first element of an INT array body, raw or already split, that Godot
 * cannot read or store. `PackedInt32Array` goes through `_parse_construct<int32_t>`
 * (`variant_parser.cpp:1428-1430`), which narrows any number token, so
 * `PackedInt32Array(2e3, 0, 0)` loads: the grammar is not `IS_VALID_INT_RE`'s.
 */
function scanIntElements(
  body: string | readonly string[],
  width: IntWidth = 'int32'
): IntElementVerdict {
  let truncated: TruncatedElement | null = null;
  for (const part of typeof body === 'string' ? body.split(',') : body) {
    const text = part.trim();
    // `parseGodotInt` spelled out, so the float is in hand for the fractional
    // test without a second `TSCN_FLOAT_RE` run on every element.
    const asFloat = parseGodotFloat(text);
    if (asFloat === null) return { error: { kind: 'unreadable', text }, truncated: null };
    // `width` is the element's C++ type: `PackedByteArray` uses `_parse_byte_array`
    // (`variant_parser.cpp:600`) into a `Vector<uint8_t>` (`:650`) through
    // `Variant::operator uint8_t()` (`variant.cpp:1519-1521`), so Godot alters
    // `300`, `-1` and `1000000000` to 44, 255 and 0.
    const stored = storedFromFloat(asFloat, text, width);
    if (Number.isNaN(stored)) {
      const kind = readerLimitedInt(asFloat, width) ? 'beyondReader' : 'unstorable';
      return { error: { kind, text }, truncated: null };
    }
    if (truncated === null && Number.isFinite(asFloat) && !Number.isInteger(asFloat)) {
      truncated = { text, stored };
    }
  }
  return { error: null, truncated };
}

/**
 * The diagnostics for the first unusable element of a packed INT body. `_FORMAT`
 * means Godot's parser could not read the element, and `_VALUE` means the slot
 * altered a real value. `width` is the element's C++ type
 * ({@link scanIntElements}), which the message names: `300` is not a byte.
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
          : error.kind === 'beyondReader'
            ? propertyError(
                key,
                line,
                `Property '${propertyName}' has an element outside the range this linter reads exactly: "${error.text}". ` +
                  `An int64 element holds it and Godot stores what the file states; no bound on this element is checked here.`,
                codes.value,
                'warning'
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
function firstNonNumericElement(body: string | readonly string[]): string | null {
  for (const part of typeof body === 'string' ? body.split(',') : body) {
    const trimmed = part.trim();
    // The component grammar, not a numeric parse: `Number()` refuses `inf`,
    // which `rtos_fix` writes into these arrays too (variant_parser.cpp:2504,
    // :2519, :2534), while `parseFloat` would accept the trailing garbage in
    // `1abc` that Godot's tokenizer stops at.
    if (!TSCN_FLOAT_RE.test(trimmed)) return trimmed;
  }
  return null;
}

/**
 * The first element of a bare or typed array body Godot could not put in this
 * slot, or null. These spellings hold one whole element per top-level comma,
 * such as `Vector2(0, 0)`, not the packed form's flat `0, 0`.
 */
function firstBadArrayElement(
  body: string,
  elementCall: RegExp,
  groupSize: number
): string | null {
  for (const part of splitTopLevel(body)) {
    const trimmed = part.trim();
    if (trimmed === '') continue;
    if (groupSize === 1) {
      if (!TSCN_FLOAT_RE.test(trimmed)) return trimmed;
      continue;
    }
    const call = elementCall.exec(trimmed);
    // The arity is the slot's own: `elementCall` carries only same-arity
    // conversions (`godot/variantConversion.ts`), so `[Vector2i(0, 0)]` is the
    // verbatim read `Variant::operator Vector2()` performs (`variant.cpp:1751-1756`),
    // while `[Vector3(0, 0, 0)]` stays an offender.
    if (!call || splitTopLevel(call[1]!).length !== groupSize) return trimmed;
    if (firstNonNumericElement(call[1]!) !== null) return trimmed;
  }
  return null;
}

/**
 * `Packed<Kind>Array(n1, n2, …)`: a format-only list of fixed-size tuples, empty
 * included. A count off a multiple of `groupSize` loads: `parse_value` divides
 * with integer division (`variant_parser.cpp:1555` Vector2Array, `:1573` Vector3Array,
 * `:1609` ColorArray). `example` overrides the message's default all-zero literal.
 */
function packedTupleArray(
  name: string,
  wrapper: string,
  groupSize: number,
  acceptsLabel: string,
  example: string = Array(groupSize).fill('0').join(', ')
): PropertyValidator {
  const formatErr = formatCode(name);
  // `wrapper` is one of this module's literal type names, never free text, so a
  // RegExp may embed it.
  const FORMS = packedArrayForms(wrapper);
  const element = packedElementType(wrapper);
  // Per validator, not per element: the spelling is fixed by the slot, and a
  // Godot-written body carries thousands of elements. It takes the converted
  // spelling for the same reason the scalar tuple grammar does.
  const ELEMENT_CALL = packedArrayLiteral(compositeSpellings(element));
  return shape((key, value, line) => {
    // The packed constructor's body is a flat argument list, and the other two
    // forms hold one element each. The matched form decides how to read the body.
    const parsed = packedArrayBody(FORMS, value);
    if (parsed === null) {
      return propertyError(
        key,
        line,
        `Property '${name}' must be a ${wrapper} like ${wrapper}(${example}), ` +
          `Array[${element}]([…]) or […], got: ${value}`,
        formatErr
      );
    }
    const { flat, body } = parsed;
    if (body === '') return null;

    const offender = flat
      ? firstNonNumericElement(body)
      : firstBadArrayElement(body, ELEMENT_CALL, groupSize);
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
   * `PackedVector2Array(x, y, x, y, …)`, coordinate pairs through {@link packedTupleArray},
   * whose message shows two pairs. An odd count loads: `parse_value` drops the
   * remainder (variant_parser.cpp:1555). `TSCN_FLOAT_RE` accepts every number
   * Godot writes, such as `4.37114e-08` and `inf_neg`.
   */
  packedVector2Array(name: string): PropertyValidator {
    return packedTupleArray(name, 'PackedVector2Array', 2, 'PackedVector2Array(x, y, …)', '0, 0, 1, 0');
  },

  /**
   * `PackedVector3Array(x, y, z, x, y, z, …)`, an arbitrary-length list of
   * vertex triples. See {@link packedTupleArray} for the shared shape and why
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
   * `PackedFloat32Array(a, b, …)`, a flat list of scalars. `groupSize` is 1: it
   * feeds only the default example, and the body check is element-wise.
   * `example` is each property's own message wording.
   */
  packedFloat32Array(name: string, example: string): PropertyValidator {
    return packedTupleArray(name, 'PackedFloat32Array', 1, 'PackedFloat32Array(x, y, …)', example);
  },
};
