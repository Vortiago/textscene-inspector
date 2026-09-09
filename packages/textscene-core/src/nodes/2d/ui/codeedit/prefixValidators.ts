/**
 * `code_completion_prefixes` / `indent_automatic_prefixes` — the two
 * single-character prefix sets, and the one asymmetry between them.
 */

import { accepts, propertyError } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { parsePackedStringArray } from './arrayForms.js';

/**
 * `code_completion_prefixes` (code_edit.cpp:3002) / `indent_automatic_prefixes`
 * (code_edit.cpp:3008): both keep only the FIRST character of each element in
 * a `HashSet<char32_t>` (`code_completion_prefixes.insert(prefix[0])`,
 * code_edit.cpp:2218; `auto_indent_prefixes.insert(prefix[0])`,
 * code_edit.cpp:952) — a multi-character element is silently truncated to its
 * first character, a genuine alteration (ADR-0032), not a format concern.
 *
 * `code_completion_prefixes` additionally refuses an empty element outright
 * (`ERR_CONTINUE_MSG`, code_edit.cpp:2217, so that entry is dropped);
 * `indent_automatic_prefixes` has no such guard, so an empty element there
 * merely inserts the character `String::operator[]` returns for an
 * out-of-bounds read on an empty String — `_null`, i.e. `'\0'`
 * (core/string/ustring.h:328-334) — and is left unflagged here, matching the
 * asymmetry in the source.
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
