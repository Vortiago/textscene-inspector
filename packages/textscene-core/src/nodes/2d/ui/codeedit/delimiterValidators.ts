/**
 * `delimiter_strings` / `delimiter_comments` — CodeEdit's two delimiter arrays,
 * which share one `delimiters` Vector in the engine.
 */

import { accepts, propertyError } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { parsePackedStringArray } from './arrayForms.js';
import { isGodotSymbol } from './symbolChars.js';

/**
 * `delimiter_strings` / `delimiter_comments` (code_edit.cpp:2997-2998): each
 * element is `"start_key"` or `"start_key end_key"`, split on the FIRST space
 * exactly as `CodeEdit::_set_delimiters` does (`key.get_slicec(' ', 0)` /
 * `key.get_slice_count(' ') > 1 ? key.get_slicec(' ', 1) : String()`,
 * code_edit.cpp:3501-3502) — a second space and anything after it is silently
 * ignored, matching the engine rather than flagging it.
 *
 * A wholly empty element is skipped with no error, matching
 * `_set_delimiters`'s own `if (key.is_empty()) { continue; }`
 * (code_edit.cpp:3497-3499). Anything else routes through `_add_delimiter`
 * (code_edit.cpp:3418-3457), whose `ERR_FAIL_COND_MSG` guards this mirrors:
 *   - an empty start key (code_edit.cpp:3421)
 *   - a start key containing a non-symbol character (code_edit.cpp:3424)
 *   - an end key containing a non-symbol character (code_edit.cpp:3430)
 *   - a start key that repeats one already in THIS array (code_edit.cpp:3436)
 *
 * A start key repeated across the OTHER `delimiter_*` property (both types
 * share one `delimiters` Vector, so the "already exists" guard applies
 * regardless of type) is a cross-property collision this single-property
 * validator cannot see; `linter.ts` catches that one instead.
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
      if (element === '') continue;

      const firstSpace = element.indexOf(' ');
      let startKey: string;
      let endKey: string;
      if (firstSpace === -1) {
        startKey = element;
        endKey = '';
      } else {
        startKey = element.slice(0, firstSpace);
        const secondSpace = element.indexOf(' ', firstSpace + 1);
        endKey =
          secondSpace === -1 ? element.slice(firstSpace + 1) : element.slice(firstSpace + 1, secondSpace);
      }

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
