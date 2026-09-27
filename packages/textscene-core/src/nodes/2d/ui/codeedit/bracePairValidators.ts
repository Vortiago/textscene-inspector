/**
 * `auto_brace_completion_pairs`, the one Dictionary-valued property on CodeEdit,
 * and the string-keyed dictionary parse it needs.
 */

import { accepts, propertyError } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { isGodotSymbol } from './symbolChars.js';
import { unquoteString } from '../../../../parser/utils.js';
import { dropTrailingComma, splitTopLevel, STRING_LITERAL_SOURCE } from '../../../../godot/index.js';

const DICT_WRAPPER_RE = /^\s*\{([\s\S]*)\}\s*$/;
/** One `"key": "value"` entry, each literal captured with its quotes. */
const DICT_PAIR_RE = new RegExp(String.raw`^(${STRING_LITERAL_SOURCE})\s*:\s*(${STRING_LITERAL_SOURCE})$`);

/**
 * `{ "key": "value", … }` as raw (unescaped) `[key, value]` pairs, or `null` if malformed, after
 * `VariantParser::_parse_dictionary` (core/variant/variant_parser.cpp:677-684). It takes `}` at
 * every key position (:1701-1703), the one after a comma too, so one trailing comma is legal. String
 * keys and values only, as `PROPERTY_HINT_TYPE_STRING "String;String"` declares: a non-string one
 * is rejected although Godot would coerce it, the scope `v.quotedString` takes too.
 */
function parseStringDictionary(value: string): Array<[string, string]> | null {
  const wrapper = DICT_WRAPPER_RE.exec(value);
  if (!wrapper) return null;
  const pairs: Array<[string, string]> = [];
  for (const entry of dropTrailingComma(splitTopLevel(wrapper[1]!))) {
    const pair = DICT_PAIR_RE.exec(entry);
    if (!pair) return null;
    pairs.push([unquoteString(pair[1]!), unquoteString(pair[2]!)]);
  }
  return pairs;
}

/**
 * `auto_brace_completion_pairs` (code_edit.cpp:3013), `Dictionary<String, String>`.
 * `set_auto_brace_completion_pairs` (code_edit.cpp:1291-1297) passes each entry to
 * `add_auto_brace_completion_pair` (code_edit.cpp:1266-1289), whose `ERR_FAIL_COND_MSG`
 * guards the loop below mirrors.
 */
export function bracePairsValidator(name: string): PropertyValidator {
  const formatCode = `INVALID_${name.toUpperCase()}_FORMAT`;
  const valueCode = `INVALID_${name.toUpperCase()}_VALUE`;
  const validator = accepts((key, value, line) => {
    const pairs = parseStringDictionary(value);
    if (pairs === null) {
      return propertyError(
        key,
        line,
        `Property '${name}' must be a Dictionary of quoted string pairs like { "(": ")" }, got: ${value}`,
        formatCode
      );
    }
    // No duplicate-key check: `_parse_dictionary` assigns `d[key] = value`, so a repeated key
    // overwrites before the setter runs, and the "already exists" guard (code_edit.cpp:1279) never fires.
    for (const [openKey, closeKey] of pairs) {
      if (openKey === '') {
        return propertyError(
          key,
          line,
          `Property '${name}' has an empty open key, which CodeEdit refuses (code_edit.cpp:1267)`,
          valueCode
        );
      }
      if (closeKey === '') {
        return propertyError(
          key,
          line,
          `Property '${name}' open key "${openKey}" has an empty close key, which CodeEdit refuses (code_edit.cpp:1268)`,
          valueCode
        );
      }
      for (const ch of openKey) {
        if (!isGodotSymbol(ch)) {
          return propertyError(
            key,
            line,
            `Property '${name}' open key "${openKey}" must be made only of symbol characters (code_edit.cpp:1271)`,
            valueCode
          );
        }
      }
      for (const ch of closeKey) {
        if (!isGodotSymbol(ch)) {
          return propertyError(
            key,
            line,
            `Property '${name}' close key "${closeKey}" (for open key "${openKey}") must be made only of symbol characters (code_edit.cpp:1274)`,
            valueCode
          );
        }
      }
    }
    return null;
  }, 'Dictionary { "open": "close", … }, each key a symbol-only string');
  validator.grounding = {
    kind: 'enforced',
    cite: 'code_edit.cpp:1267, code_edit.cpp:1268, code_edit.cpp:1271, code_edit.cpp:1274',
  };
  return validator;
}
