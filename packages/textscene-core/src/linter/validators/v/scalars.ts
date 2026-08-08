/**
 * The single-token literals: a boolean, a quoted string, and the `StringName`
 * spelling Godot writes with a leading `&`.
 */

import type { PropertyValidator } from '../../ValidatorRegistry.js';
import { propertyError } from '../propertyError.js';
import { createBooleanValidator } from '../commonValidators.js';
import { formatCode } from './codes.js';
import { shape } from './grounding.js';

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
};
