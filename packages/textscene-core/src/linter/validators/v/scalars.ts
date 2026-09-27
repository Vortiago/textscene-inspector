/**
 * The single-token literals: a boolean, a quoted string, and the `StringName`
 * spelling Godot writes with a leading `&`.
 */

import type { PropertyValidator } from '../../ValidatorRegistry.js';
import { propertyError } from '../propertyError.js';
import { createBooleanValidator } from '../commonValidators.js';
import { formatCode } from './codes.js';
import { shape } from './grounding.js';
import { ARRAY_LITERAL_RE, STRING_LITERAL_SOURCE, TYPED_WRAPPER_RE } from '../../../godot/index.js';
import { arrayLiteralBody } from '../../../godot/variantParser.js';
import { unquoteString } from '../../../parser/utils.js';
import { valueCode } from './codes.js';

/**
 * One TSCN string literal as a STRING or STRING_NAME slot takes it: an optional `&`
 * jacket or its 3.x spelling `@`, kept under `#ifndef DISABLE_DEPRECATED`
 * (`TK_STRING_NAME`, `variant_parser.cpp:262-265`), then one literal and nothing after it.
 */
const JACKETED_STRING_RE = new RegExp(`^[&@]?${STRING_LITERAL_SOURCE}$`);

export const scalarCombinators = {
  /** Boolean (`'true'` | `'false'`). */
  boolean(name: string): PropertyValidator {
    return shape(createBooleanValidator(name, formatCode(name)), 'true or false');
  },

  /**
   * Quoted string `"..."`, or the `&"..."` StringName jacket the slot converts.
   * Used for properties like `Label3D.text` that take TSCN string literals.
   */
  quotedString(name: string): PropertyValidator {
    // `variant.cpp:582-587` makes STRING_NAME a strict source for STRING, and
    // `VariantCasterAndValidate` (`binder_common.h:175`) gates a setter on it, so
    // `text = &"Hello"` stores `Hello`.
    const code = formatCode(name);
    return shape((key, value, line) => {
      if (!JACKETED_STRING_RE.test(value)) {
        return propertyError(key, line, `Property '${name}' must be a quoted string, got: ${value}`, code);
      }
      return null;
    }, 'quoted string, or the &"…" StringName jacket');
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
      if (!JACKETED_STRING_RE.test(value)) {
        return propertyError(
          key,
          line,
          `Property '${name}' must be a quoted string, got: ${value}`,
          format
        );
      }
      const text = unquoteString(value);
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
    validator.accepts = 'quoted string (or the &"…" StringName jacket), at most one character';
    validator.grounding = { kind: 'enforced', cite: opts.enforced };
    return validator;
  },

  /**
   * A `Variant::ARRAY` property's literal shape. `typedAs: 'T'` is a `TypedArray<T>`
   * setter, whose `Array::assign` refuses another element type. `anyElementType`
   * is a bare `const Array &` or `get_type()` gate; cite its `file:line` at the
   * call site. With neither, a wrapper is refused until the setter is read.
   */
  arrayLiteral(name: string, opts?: { typedAs?: string; anyElementType?: true }): PropertyValidator {
    // `Array::is_typed()` decides only whether the writer emits a wrapper
    // (variant_parser.cpp:2341-2344), which never bounds the loader. Elements go
    // unchecked: every one of these setters bare-assigns the whole array.
    const code = formatCode(name);
    const typed = opts?.typedAs;
    const anyType = opts?.anyElementType === true;
    const wrapper = anyType ? ' or Array[T]([...])' : typed ? ` or Array[${typed}]([...])` : '';
    return shape((key, value, line) => {
      const reject = () =>
        propertyError(
          key,
          line,
          `Property '${name}' must be an Array literal like []${wrapper}, got: ${value}`,
          code
        );
      const wrapped = TYPED_WRAPPER_RE.exec(value.trim());
      if (wrapped) {
        if (anyType) return null;
        return typed !== undefined && wrapped[1]!.trim() === typed ? null : reject();
      }
      return ARRAY_LITERAL_RE.test(value) ? null : reject();
    }, `Array literal ([...]${wrapper})`);
  },
};

/**
 * The raw element text of a value {@link scalarCombinators.arrayLiteral} has
 * already accepted, for a caller that goes on to count or split the elements.
 */
export function arrayLiteralElements(value: string): string {
  return arrayLiteralBody(value) ?? '';
}
