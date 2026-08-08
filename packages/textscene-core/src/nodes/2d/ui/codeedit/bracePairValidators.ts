/**
 * `auto_brace_completion_pairs` — the one Dictionary-valued property on
 * CodeEdit, and the string-keyed dictionary parse it needs.
 */

import { accepts, propertyError } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { isGodotSymbol } from './symbolChars.js';

const DICT_WRAPPER_RE = /^\s*\{([\s\S]*)\}\s*$/;
const DICT_PAIR_BODY_RE =
  /^"(?:[^"\\]|\\[\s\S])*"\s*:\s*"(?:[^"\\]|\\[\s\S])*"(?:\s*,\s*"(?:[^"\\]|\\[\s\S])*"\s*:\s*"(?:[^"\\]|\\[\s\S])*")*$/;
const DICT_PAIR_CAPTURE_RE = /"((?:[^"\\]|\\[\s\S])*)"\s*:\s*"((?:[^"\\]|\\[\s\S])*)"/g;

/**
 * `{ "key": "value", … }` into raw (unescaped) `[key, value]` pairs, or `null`
 * if malformed — mirrors `VariantParser::_parse_dictionary`
 * (core/variant/variant_parser.cpp:677-684), which is reached for a
 * `TK_CURLY_BRACKET_OPEN` token. Scoped to string-keyed, string-valued
 * dictionaries only (what `auto_brace_completion_pairs`'s
 * `PROPERTY_HINT_TYPE_STRING "String;String"` declares); a non-string
 * key/value is format-rejected here even though Godot's own Variant-to-String
 * coercion would tolerate one, the same pragmatic scope `v.quotedString`
 * takes over a general string literal.
 */
function parseStringDictionary(value: string): Array<[string, string]> | null {
  const wrapper = DICT_WRAPPER_RE.exec(value);
  if (!wrapper) return null;
  const body = wrapper[1]!.trim();
  if (body === '') return [];
  if (!DICT_PAIR_BODY_RE.test(body)) return null;
  const pairs: Array<[string, string]> = [];
  for (const m of body.matchAll(DICT_PAIR_CAPTURE_RE)) {
    pairs.push([(m[1] ?? '').replace(/\\(.)/g, '$1'), (m[2] ?? '').replace(/\\(.)/g, '$1')]);
  }
  return pairs;
}

/**
 * `auto_brace_completion_pairs` (code_edit.cpp:3013): `Dictionary<String,
 * String>`. `set_auto_brace_completion_pairs` (code_edit.cpp:1291-1297)
 * forwards every entry to `add_auto_brace_completion_pair`
 * (code_edit.cpp:1266-1289), whose `ERR_FAIL_COND_MSG` guards this mirrors:
 * an empty open key (code_edit.cpp:1267), an empty close key
 * (code_edit.cpp:1268), a non-symbol character in the open key
 * (code_edit.cpp:1271), or in the close key (code_edit.cpp:1274).
 *
 * No duplicate-open-key check is needed: a Dictionary LITERAL can never carry
 * two entries with the same key in the first place —
 * `VariantParser::_parse_dictionary` assigns `d[key] = value` for each pair
 * (core/variant/variant_parser.cpp:677-684), so a repeated key in the
 * `.tscn` text just overwrites in place before `set_auto_brace_completion_pairs`
 * ever runs, and `add_auto_brace_completion_pair`'s own "already exists" guard
 * (code_edit.cpp:1279) can never see a duplicate coming from this property.
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
