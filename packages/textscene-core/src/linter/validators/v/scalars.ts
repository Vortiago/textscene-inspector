/**
 * The single-token literals: a boolean, a quoted string, and the `StringName`
 * spelling Godot writes with a leading `&`.
 */

import type { PropertyValidator } from '../../ValidatorRegistry.js';
import type { ParseError } from '../../types.js';
import { propertyError } from '../propertyError.js';
import { createBooleanValidator } from '../commonValidators.js';
import { formatCode } from './codes.js';
import { accepts, shape } from './grounding.js';
import {
  ARRAY_LITERAL_RE,
  JACKETED_STRING_RE,
  NODE_PATH_LITERAL_RE,
  TYPED_WRAPPER_RE,
} from '../../../godot/index.js';
import { arrayLiteralBody } from '../../../godot/variantParser.js';
import { unquoteString } from '../../../parser/utils.js';
import { valueCode } from './codes.js';

/**
 * The text a STRING slot stores from this value, or null when the slot takes
 * none: a jacketed string, or a `NodePath("…")` literal (`variant_parser.cpp:920-939`).
 * STRING converts both strictly (`variant.cpp:582-589`), and
 * `VariantCasterAndValidate` gates the setter on that (`binder_common.h:175`).
 */
function stringSlotText(value: string): string | null {
  if (JACKETED_STRING_RE.test(value)) return unquoteString(value);
  const nodePath = NODE_PATH_LITERAL_RE.exec(value.trim());
  return nodePath ? unquoteString(`"${nodePath[1]!}"`) : null;
}

export const scalarCombinators = {
  /** Boolean (`'true'` | `'false'`). */
  boolean(name: string): PropertyValidator {
    return shape(createBooleanValidator(name, formatCode(name)), 'true or false');
  },

  /**
   * Quoted string `"..."`, or a StringName or NodePath literal the slot converts:
   * `text = &"Hello"` and `text = NodePath("Hello")` both store `Hello`.
   * Used for properties like `Label3D.text` that take TSCN string literals.
   */
  quotedString(name: string): PropertyValidator {
    const code = formatCode(name);
    return shape((key, value, line) => {
      if (stringSlotText(value) === null) {
        return propertyError(key, line, `Property '${name}' must be a quoted string, got: ${value}`, code);
      }
      return null;
    }, 'quoted string, or the &"…" StringName or NodePath("…") it converts');
  },

  /**
   * A `StringName` property: Godot writes `&"value"`, and the variant text
   * parser also accepts a plain `"value"`.
   */
  stringName(name: string): PropertyValidator {
    const code = formatCode(name);
    return shape((key, value, line) => {
      if (!JACKETED_STRING_RE.test(value)) {
        return propertyError(
          key,
          line,
          `Property '${name}' must be a string, quoted or a StringName literal (&"…"), got: ${value}`,
          code
        );
      }
      return null;
    }, 'quoted string or &"name"');
  },

  /**
   * A string slot the setter cuts to its first character, counted in code
   * points of the decoded text: `String` is UTF-32, and the tokenizer resolves
   * `\uXXXX` first, so `"\u2026"` is one character. An empty literal is legal,
   * since `left(1)` of `""` is `""`.
   *
   * @param enforced - `file:line` of the `left(1)` that cuts the value, which is
   *   the "silently alters the write" branch of ADR-0032 and so the error tier.
   */
  singleCharacter(name: string, opts: { enforced: string }): PropertyValidator {
    const format = formatCode(name);
    const code = valueCode(name);
    const validator: PropertyValidator = (key, value, line) => {
      const text = stringSlotText(value);
      if (text === null) {
        return propertyError(key, line, `Property '${name}' must be a quoted string, got: ${value}`, format);
      }
      const characters = [...text].length;
      if (characters > 1) {
        return propertyError(
          key,
          line,
          `Property '${name}' must be at most one character, got ${characters} characters: "${text}"`,
          code
        );
      }
      return null;
    };
    validator.accepts =
      'quoted string (or the &"…" StringName or NodePath("…") it converts), at most one character';
    validator.grounding = { kind: 'enforced', cite: opts.enforced };
    return validator;
  },

  /**
   * A `Variant::ARRAY` property. Untyped, it takes any `[…]` or `Array[T]([…])`:
   * a `const Array &` setter keeps the array as parsed (`array.cpp:217-227`), so
   * it refuses only what the tokenizer cannot read. `typed` is a slot with an
   * element type, whose refusal of another `T` carries a citation.
   */
  arrayLiteral(name: string, typed?: TypedArraySlot): PropertyValidator {
    const format = formatCode(name);
    const wrapper = typed ? `Array[${typed.typedAs}]([...])` : 'Array[T]([...])';
    const description = `Array literal ([...] or ${wrapper})`;
    const readable = (key: string, value: string, line: number) =>
      ARRAY_LITERAL_RE.test(value) || TYPED_WRAPPER_RE.test(value.trim())
        ? null
        : propertyError(
            key,
            line,
            `Property '${name}' must be an Array literal like [] or ${wrapper}, got: ${value}`,
            format
          );
    if (!typed) return shape(readable, description);
    return typedArrayLiteral(name, typed, readable, description);
  },
};

/**
 * An ARRAY slot with an element type, and where its refusal of another type
 * comes from. `enforced`: a `TypedArray<T>` setter, whose `Array::assign`
 * fails on another typed array (`array.cpp:275-277`), an error. `hinted`: a bare
 * `const Array &` setter behind a `PROPERTY_HINT_ARRAY_TYPE`, a warning.
 */
export type TypedArraySlot = { typedAs: string } & (
  { enforced: string; hinted?: never } | { hinted: string; enforced?: never }
);

/**
 * The typed half of {@link scalarCombinators.arrayLiteral}: a wrapper naming
 * another element type is refused at the slot's tier, with its citation.
 */
function typedArrayLiteral(
  name: string,
  typed: TypedArraySlot,
  readable: (key: string, value: string, line: number) => ParseError | null,
  description: string
): PropertyValidator {
  const cite = typed.enforced ?? typed.hinted!;
  const severity = typed.enforced !== undefined ? 'error' : 'warning';
  const validator: PropertyValidator = (key, value, line) => {
    const unreadable = readable(key, value, line);
    if (unreadable) return unreadable;
    const wrapped = TYPED_WRAPPER_RE.exec(value.trim());
    if (!wrapped || wrapped[1]!.trim() === typed.typedAs) return null;
    return propertyError(
      key,
      line,
      `Property '${name}' holds ${typed.typedAs} elements, got an Array[${wrapped[1]!.trim()}] (${cite})`,
      valueCode(name),
      severity
    );
  };
  validator.grounding = { kind: typed.enforced !== undefined ? 'enforced' : 'hinted', cite };
  return accepts(validator, description);
}

/**
 * The raw element text of a value {@link scalarCombinators.arrayLiteral} has
 * already accepted, for a caller that goes on to count or split the elements.
 */
export function arrayLiteralElements(value: string): string {
  return arrayLiteralBody(value) ?? '';
}
