/**
 * The single-token literals: a boolean, a quoted string, and the `StringName`
 * spelling Godot writes with a leading `&`.
 */

import type { PropertyValidator } from '../../ValidatorRegistry.js';
import { propertyError } from '../propertyError.js';
import { createBooleanValidator } from '../commonValidators.js';
import { formatCode } from './codes.js';
import { shape } from './grounding.js';
import { ARRAY_LITERAL_RE, TYPED_WRAPPER_RE } from '../../../godot/index.js';

/**
 * One TSCN quoted literal: a quote, an escape-aware body, a closing quote, and
 * nothing after it. The previous `".*"` only checked the first and last
 * character, so it accepted `"Head" junk "Tail"` as a single string.
 *
 * `\"` inside the value is honoured. A raw newline is accepted too — the body
 * class permits one — which costs nothing, because StrictTscnParser skips
 * multiline properties before any validator sees them.
 *
 * Measured before tightening: across the corpus (699 files, 1,971 quoted
 * values) this and `".*"` disagree on nothing, so no real scene changes verdict.
 */
const QUOTED_RE = /^"(?:[^"\\]|\\[\s\S])*"$/;
const STRING_NAME_RE = /^&?"(?:[^"\\]|\\[\s\S])*"$/;

export const scalarCombinators = {
  /** Boolean (`'true'` | `'false'`). */
  boolean(name: string): PropertyValidator {
    return shape(createBooleanValidator(name, formatCode(name)), 'true or false');
  },

  /**
   * Quoted string `"..."` — value must begin and end with a double quote.
   * Used for properties like `Label3D.text` that take TSCN string literals.
   */
  quotedString(name: string): PropertyValidator {
    const code = formatCode(name);
    return shape((key, value, line) => {
      if (!QUOTED_RE.test(value)) {
        return propertyError(key, line, `Property '${name}' must be a quoted string, got: ${value}`, code);
      }
      return null;
    }, 'quoted string');
  },

  /**
   * A `StringName` property: Godot writes `&"value"`, but the variant text
   * parser also accepts a plain `"value"`, and both appear in real scenes — so
   * `quotedString` would reject the form the engine itself saves.
   */
  stringName(name: string): PropertyValidator {
    const code = formatCode(name);
    return shape((key, value, line) => {
      if (!STRING_NAME_RE.test(value)) {
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
   * A `Variant::ARRAY` property's literal shape, and nothing about its elements.
   *
   * `typedAs` names the element type when the `ADD_PROPERTY` carries a
   * `PROPERTY_HINT_ARRAY_TYPE`, and it is REQUIRED to accept the wrapped
   * `Array[T]([…])` form: `Array::is_typed()` is what makes the writer emit that
   * wrapper (variant_parser.cpp:2341-2344), so an unhinted property is never
   * written wrapped. Whether to accept the wrapper anyway is therefore a
   * per-property question and deliberately not a default — seven call sites had
   * each answered it from their own property's hint, and collapsing them onto one
   * answer would have silently widened five of them.
   *
   * Elements go unchecked because every one of these setters bare-assigns the
   * whole array with no per-element guard; a stricter validator would reject
   * values the engine loads.
   */
  arrayLiteral(name: string, opts?: { typedAs?: string }): PropertyValidator {
    const code = formatCode(name);
    const typed = opts?.typedAs;
    const wrapper = typed ? ` or Array[${typed}]([...])` : '';
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
        // The wrapper names its element type, and `Array::assign` refuses a
        // typed array whose type is not the property's, so matching the wrapper
        // shape alone would accept `Array[Dictionary]` for a RichTextEffect
        // slot. An unhinted property takes no wrapper at all.
        return typed !== undefined && wrapped[1]!.trim() === typed ? null : reject();
      }
      return ARRAY_LITERAL_RE.test(value) ? null : reject();
    }, `Array literal ([...]${wrapper})`);
  },
};
