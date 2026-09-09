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
import { arrayLiteralBody } from '../../../godot/variantParser.js';
import { unquoteString } from '../../../parser/utils.js';
import { valueCode } from './codes.js';

/**
 * One TSCN string literal as a STRING slot takes it: an optional StringName
 * jacket, a quote, an escape-aware body, a closing quote, and nothing after
 * it. `".*"` only checked the first and last character, so it accepted
 * `"Head" junk "Tail"` as a single string.
 *
 * The tokenizer reads `&"…"` and the 3.x-compatible `@"…"` as one
 * `TK_STRING_NAME` (`variant_parser.cpp:263-265`), and `variant.cpp:582-587`
 * lists `STRING_NAME` as a strict source for `STRING` —
 * `VariantCasterAndValidate` (`binder_common.h:175`) gates a setter argument
 * on `can_convert_strict` — so `text = &"Hello"` stores `Hello`.
 *
 * `\"` inside the value is honoured. A raw newline is accepted too — the body
 * class permits one — which costs nothing, because StrictTscnParser skips
 * multiline properties before any validator sees them.
 */
const QUOTED_RE = /^[&@]?"(?:[^"\\]|\\[\s\S])*"$/;
// `[&@]`, the same pair QUOTED_RE takes: `case '@':` falls through to the
// StringName case under `#ifndef DISABLE_DEPRECATED`
// (variant_parser.cpp:262-265), so both jackets load. The two grammars
// disagreeing put an error on a value the file's own sibling accepted.
const STRING_NAME_RE = /^[&@]?"(?:[^"\\]|\\[\s\S])*"$/;

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
    const code = formatCode(name);
    return shape((key, value, line) => {
      if (!QUOTED_RE.test(value)) {
        return propertyError(key, line, `Property '${name}' must be a quoted string, got: ${value}`, code);
      }
      return null;
    }, 'quoted string, or the &"…" StringName jacket');
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
   * A string slot the setter cuts to its first character.
   *
   * Counted in CODE POINTS off the DECODED text, because both halves of the
   * comparison are the engine's: `String` is UTF-32, so `left(1)` keeps one code
   * point and `"\ud83d\udd12"` is one character to Godot and two UTF-16 units to
   * JS; and the tokenizer resolves `\uXXXX` before the setter runs, so
   * `ellipsis_char = "\u2026"` is one character, not six. Measuring the raw
   * literal in JS units errored on both, on files Godot loads unaltered.
   *
   * An empty literal is legal — `left(1)` of `""` is `""` — and each caller's
   * own fallback, not the setter's, decides what is drawn then.
   *
   * @param enforced - `file:line` of the `left(1)` that cuts the value, which is
   *   the "silently alters the write" branch of ADR-0032 and so the error tier.
   */
  singleCharacter(name: string, opts: { enforced: string }): PropertyValidator {
    const format = formatCode(name);
    const code = valueCode(name);
    const validator: PropertyValidator = (key, value, line) => {
      if (!QUOTED_RE.test(value)) {
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
   * A `Variant::ARRAY` property's literal shape, and nothing about its elements.
   *
   * Which wrapped `Array[T]([…])` values load is the SETTER's question, and
   * there are three answers:
   *
   * - `typedAs: 'T'` — the property carries a `PROPERTY_HINT_ARRAY_TYPE` and
   *   its setter takes a `TypedArray<T>`, so `Array::assign` refuses an array
   *   typed as anything else. Matching the wrapper shape alone would accept
   *   `Array[Dictionary]` for a RichTextEffect slot.
   * - `anyElementType: true` — the setter takes a bare `const Array &`, or
   *   `_set` tests only `p_value.get_type() != Variant::ARRAY`. A typed array
   *   IS `Variant::ARRAY`, so EVERY element type loads. Name the `file:line` of
   *   that gate at the call site.
   * - neither — not yet answered from the setter. The wrapper is refused,
   *   which is the narrow answer and the one to widen once the engine line has
   *   been read.
   *
   * `Array::is_typed()` deciding whether the WRITER emits a wrapper
   * (variant_parser.cpp:2341-2344) does not bound any of this: what Godot saves
   * never limits what it loads, and a hand-edited or foreign-tool file is
   * exactly the file a linter exists for.
   *
   * Elements go unchecked because every one of these setters bare-assigns the
   * whole array with no per-element guard; a stricter validator would reject
   * values the engine loads.
   */
  arrayLiteral(name: string, opts?: { typedAs?: string; anyElementType?: true }): PropertyValidator {
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
 * The raw ELEMENT text of a value {@link scalarCombinators.arrayLiteral} has
 * already accepted, for a caller that goes on to count or split the elements.
 */
export function arrayLiteralElements(value: string): string {
  return arrayLiteralBody(value) ?? '';
}
