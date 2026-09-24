/**
 * `code_completion_prefixes` and `indent_automatic_prefixes`, the two
 * single-character prefix sets, and the one asymmetry between them.
 */

import { accepts, propertyError } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { parsePackedStringArray } from './arrayForms.js';

/**
 * `code_completion_prefixes` (code_edit.cpp:3002) and `indent_automatic_prefixes` (code_edit.cpp:3008)
 * keep only each element's first character (code_edit.cpp:2218, code_edit.cpp:952), an alteration
 * (ADR-0032). Only `code_completion_prefixes` drops an empty element (code_edit.cpp:2217). The other
 * inserts `'\0'`, what an empty String's `operator[]` returns (core/string/ustring.h:328-334), unflagged.
 */
export function prefixArrayValidator(
  name: string,
  opts: { emptyCite?: string; truncationCite: string }
): PropertyValidator {
  const formatCode = `INVALID_${name.toUpperCase()}_FORMAT`;
  const valueCode = `INVALID_${name.toUpperCase()}_VALUE`;
  const validator = accepts((key, value, line) => {
    const elements = parsePackedStringArray(value);
    if (elements === null) {
      return propertyError(
        key,
        line,
        `Property '${name}' must be an array of quoted strings like Array[String](["."]), got: ${value}`,
        formatCode
      );
    }
    for (const element of elements) {
      if (element === '') {
        if (opts.emptyCite) {
          return propertyError(
            key,
            line,
            `Property '${name}' contains an empty prefix, which CodeEdit refuses (${opts.emptyCite})`,
            valueCode
          );
        }
        continue;
      }
      if ([...element].length !== 1) {
        return propertyError(
          key,
          line,
          `Property '${name}' element "${element}" is more than one character; CodeEdit keeps only the first (${opts.truncationCite}), silently dropping the rest`,
          valueCode
        );
      }
    }
    return null;
  }, 'string array (Array[String]([…]), PackedStringArray(…) or […]), each a single character');
  validator.grounding = {
    kind: 'enforced',
    cite: opts.emptyCite ? `${opts.emptyCite}, ${opts.truncationCite}` : opts.truncationCite,
  };
  return validator;
}
