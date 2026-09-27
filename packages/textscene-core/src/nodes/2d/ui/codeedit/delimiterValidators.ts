/**
 * `delimiter_strings` and `delimiter_comments`, CodeEdit's two delimiter arrays,
 * which share one `delimiters` Vector in the engine.
 */

import { accepts, propertyError } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { parsePackedStringArray } from './arrayForms.js';
import { splitDelimiterEntry } from './delimiterEntry.js';
import { isGodotSymbol } from './symbolChars.js';

/**
 * `delimiter_strings` and `delimiter_comments` (code_edit.cpp:2997-2998). The guards mirror
 * `_add_delimiter` (code_edit.cpp:3418-3457): an empty or non-symbol start key, a non-symbol end
 * key, a repeated start key (code_edit.cpp:3436). A start key repeated across the other property
 * shares the same `delimiters` Vector, and `linter.ts` catches that collision.
 */
export function delimiterArrayValidator(name: string): PropertyValidator {
  const formatCode = `INVALID_${name.toUpperCase()}_FORMAT`;
  const valueCode = `INVALID_${name.toUpperCase()}_VALUE`;
  const validator = accepts((key, value, line) => {
    const elements = parsePackedStringArray(value);
    if (elements === null) {
      return propertyError(
        key,
        line,
        `Property '${name}' must be an array of quoted strings like Array[String](["' '", "# "]), got: ${value}`,
        formatCode
      );
    }

    const seenStartKeys = new Set<string>();
    for (const element of elements) {
      // `_set_delimiters` skips an empty element (code_edit.cpp:3497-3499).
      if (element === '') continue;

      const { startKey, endKey } = splitDelimiterEntry(element);

      if (startKey === '') {
        return propertyError(
          key,
          line,
          `Property '${name}' has an element with an empty delimiter start key: "${element}". CodeEdit::_add_delimiter refuses an empty start key (code_edit.cpp:3421)`,
          valueCode
        );
      }
      for (const ch of startKey) {
        if (!isGodotSymbol(ch)) {
          return propertyError(
            key,
            line,
            `Property '${name}' delimiter start key "${startKey}" must be made only of symbol characters (code_edit.cpp:3424), got: "${element}"`,
            valueCode
          );
        }
      }
      for (const ch of endKey) {
        if (!isGodotSymbol(ch)) {
          return propertyError(
            key,
            line,
            `Property '${name}' delimiter end key "${endKey}" must be made only of symbol characters (code_edit.cpp:3430), got: "${element}"`,
            valueCode
          );
        }
      }
      if (seenStartKeys.has(startKey)) {
        return propertyError(
          key,
          line,
          `Property '${name}' declares delimiter start key "${startKey}" more than once. CodeEdit::_add_delimiter refuses a repeated start key (code_edit.cpp:3436), so only the first survives`,
          valueCode
        );
      }
      seenStartKeys.add(startKey);
    }
    return null;
  }, 'string array (Array[String]([…]), PackedStringArray(…) or […]), each a symbol-only "start[ end]" delimiter key');
  validator.grounding = {
    kind: 'enforced',
    cite: 'code_edit.cpp:3421, code_edit.cpp:3424, code_edit.cpp:3430, code_edit.cpp:3436',
  };
  return validator;
}
