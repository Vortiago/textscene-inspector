/**
 * CodeEdit strict validators for linting.
 *
 * Declare only CodeEdit's OWN members — the ones doc/classes/CodeEdit.xml
 * lists without an `overrides=` attribute. Everything from TextEdit up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * `layout_direction` (`overrides="Control"`) and `text_direction`
 * (`overrides="TextEdit"`) are skipped: both are default-value overrides only
 * — `CodeEdit::_bind_methods` (code_edit.cpp:2776-3081) never re-declares
 * either with its own `ADD_PROPERTY`, so both validators stay with the
 * ancestor that owns them.
 *
 * Grouped to match `CodeEdit::_bind_methods`'s own `ADD_GROUP` structure
 * (code_edit.cpp:2977-3013): an ungrouped run (symbol lookup/tooltip, line
 * folding, line length guidelines), then Gutters, Delimiters, Code
 * Completion, Indentation, and Auto Brace Completion.
 */

import '../textedit/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { accepts, propertyError, v } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { arrayBody, INT_ARRAY_FORMS, STRING_ARRAY_FORMS } from './arrayForms.js';

/**
 * Mirrors `is_symbol` (core/string/char_utils.h:113-114): every ASCII
 * punctuation range plus tab and space, excluding underscore. Godot's
 * delimiter and auto-brace-completion keys must be made only of these.
 */
function isGodotSymbol(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  if (code === 0x5f) return false;
  return (
    (code >= 0x21 && code <= 0x2f) ||
    (code >= 0x3a && code <= 0x40) ||
    (code >= 0x5b && code <= 0x60) ||
    (code >= 0x7b && code <= 0x7e) ||
    code === 0x09 ||
    code === 0x20
  );
}

const PACKED_STRING_ARRAY_BODY_RE = /^"(?:[^"\\]|\\[\s\S])*"(?:\s*,\s*"(?:[^"\\]|\\[\s\S])*")*$/;
const QUOTED_ELEMENT_CAPTURE_RE = /"((?:[^"\\]|\\[\s\S])*)"/g;

/**
 * Any of the three string-array spellings into raw (unescaped) elements, or
 * `null` if the literal is malformed — the element grammar mirrors
 * `variant_parser.cpp:1500-1533`'s PackedStringArray branch, which requires
 * every element to be a TK_STRING token. No `v.ts` combinator covers this shape
 * (only `packedVector2Array` exists), matching `FileDialog.filters`
 * (nodes/windows/filedialog/linterParser.ts).
 */
function parsePackedStringArray(value: string): string[] | null {
  const body = arrayBody(value, STRING_ARRAY_FORMS);
  if (body === undefined) return null;
  if (body === '') return [];
  if (!PACKED_STRING_ARRAY_BODY_RE.test(body)) return null;
  const elements: string[] = [];
  for (const m of body.matchAll(QUOTED_ELEMENT_CAPTURE_RE)) {
    elements.push((m[1] ?? '').replace(/\\(.)/g, '$1'));
  }
  return elements;
}

const INTEGER_LITERAL_RE = /^[+-]?\d+$/;

/**
 * `line_length_guidelines` — `set_line_length_guidelines`
 * (code_edit.cpp:2499-2502) stores the array verbatim with no per-element check
 * at all (no clamp, no sort, no uniqueness requirement): format-only, mirroring
 * `SplitContainer.split_offsets`
 * (nodes/2d/ui/splitcontainer/linterParser.ts), which is the same shape.
 */
function lineLengthGuidelinesValidator(): PropertyValidator {
  const code = 'INVALID_LINE_LENGTH_GUIDELINES_FORMAT';
  const validator = accepts((key, value, line) => {
    const body = arrayBody(value, INT_ARRAY_FORMS);
    if (body === undefined) {
      return propertyError(
        key,
        line,
        `Property 'line_length_guidelines' must be an int array like PackedInt32Array(80, 120), Array[int]([80, 120]) or [80, 120], got: "${value}"`,
        code
      );
    }
    if (body === '') return null;
    for (const part of body.split(',')) {
      const trimmed = part.trim();
      if (!INTEGER_LITERAL_RE.test(trimmed)) {
        return propertyError(
          key,
          line,
          `Property 'line_length_guidelines' contains a non-integer value: "${trimmed}"`,
          code
        );
      }
    }
    return null;
  }, 'int array (PackedInt32Array(…), Array[int]([…]) or […])');
  // Format-only: rejects a malformed literal or a non-integer element only.
  // `set_line_length_guidelines` accepts any length and any value.
  validator.formatOnly = true;
  return validator;
}

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
function delimiterArrayValidator(name: string): PropertyValidator {
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
function prefixArrayValidator(
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
function bracePairsValidator(name: string): PropertyValidator {
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

validatorRegistry.registerAll('CodeEdit', {
  // Ungrouped (code_edit.cpp:2977-2981).
  // code_edit.cpp:2977 — BOOL, no hint. set_symbol_lookup_on_click_enabled
  // (code_edit.cpp:2509-2512) is a bare assignment plus a side-effecting call.
  symbol_lookup_on_click: v.boolean('symbol_lookup_on_click'),
  // code_edit.cpp:2978 — BOOL, no hint. set_symbol_tooltip_on_hover_enabled
  // (code_edit.cpp:2581-2586) is a bare assignment.
  symbol_tooltip_on_hover: v.boolean('symbol_tooltip_on_hover'),
  // code_edit.cpp:2979 — BOOL, no hint. set_line_folding_enabled
  // (code_edit.cpp:1653-1656) is a bare assignment.
  line_folding: v.boolean('line_folding'),
  // code_edit.cpp:2981 — PACKED_INT32_ARRAY, no hint (see validator doc above).
  line_length_guidelines: lineLengthGuidelinesValidator(),

  // Gutters (ADD_GROUP "Gutters", "gutters_", code_edit.cpp:2983-2994).
  // code_edit.cpp:2984 — BOOL, no hint. set_draw_breakpoints_gutter
  // (code_edit.cpp:1339-1343) is a bare assignment plus side-effecting calls.
  gutters_draw_breakpoints_gutter: v.boolean('gutters_draw_breakpoints_gutter'),
  // code_edit.cpp:2986 — BOOL, no hint. set_draw_bookmarks_gutter
  // (code_edit.cpp:1349-1352) is a bare assignment.
  gutters_draw_bookmarks: v.boolean('gutters_draw_bookmarks'),
  // code_edit.cpp:2988 — BOOL, no hint. set_draw_executing_lines_gutter
  // (code_edit.cpp:1358-1361) is a bare assignment.
  gutters_draw_executing_lines: v.boolean('gutters_draw_executing_lines'),
  // code_edit.cpp:2990 — BOOL, no hint. set_draw_line_numbers
  // (code_edit.cpp:1514-1516) forwards to set_gutter_draw, a bare assignment.
  gutters_draw_line_numbers: v.boolean('gutters_draw_line_numbers'),
  // code_edit.cpp:2991 — BOOL, no hint. set_line_numbers_zero_padded
  // (code_edit.cpp:1522-1531) is a bare assignment (an early-out guard, no clamp).
  gutters_zero_pad_line_numbers: v.boolean('gutters_zero_pad_line_numbers'),
  // code_edit.cpp:2992 — INT, PROPERTY_HINT_RANGE "1,5,1" (no or_greater/or_less,
  // so both ends are closed). set_line_numbers_min_digits (code_edit.cpp:1537-1551)
  // assigns unconditionally, no ERR_FAIL or clamp: hinted, not enforced.
  gutters_line_numbers_min_digits: v.int('gutters_line_numbers_min_digits', {
    min: 1,
    max: 5,
    hinted: 'code_edit.cpp:2992',
  }),
  // code_edit.cpp:2994 — BOOL, no hint. set_draw_fold_gutter
  // (code_edit.cpp:1611-1613) forwards to set_gutter_draw, a bare assignment.
  gutters_draw_fold_gutter: v.boolean('gutters_draw_fold_gutter'),

  // Delimiters (ADD_GROUP "Delimiters", "delimiter_", code_edit.cpp:2996-2998).
  // code_edit.cpp:2997 (see validator doc above).
  delimiter_strings: delimiterArrayValidator('delimiter_strings'),
  // code_edit.cpp:2998 (see validator doc above).
  delimiter_comments: delimiterArrayValidator('delimiter_comments'),

  // Code Completion (ADD_GROUP "Code Completion", "code_completion_",
  // code_edit.cpp:3000-3002).
  // code_edit.cpp:3001 — BOOL, PROPERTY_HINT_GROUP_ENABLE (an inspector
  // group-collapse hint, not a value bound). set_code_completion_enabled
  // (code_edit.cpp:2204-2206) is a bare assignment.
  code_completion_enabled: v.boolean('code_completion_enabled'),
  // code_edit.cpp:3002 (see validator doc above).
  code_completion_prefixes: prefixArrayValidator('code_completion_prefixes', {
    emptyCite: 'code_edit.cpp:2217',
    truncationCite: 'code_edit.cpp:2218',
  }),

  // Indentation (ADD_GROUP "Indentation", "indent_", code_edit.cpp:3004-3008).
  // code_edit.cpp:3005 — INT, no hint. set_indent_size (code_edit.cpp:908-921)
  // is `ERR_FAIL_COND_MSG(p_size <= 0, …)`: enforced floor, no ceiling anywhere.
  indent_size: v.int('indent_size', { min: 1, enforced: 'code_edit.cpp:909' }),
  // code_edit.cpp:3006 — BOOL, no hint. set_indent_using_spaces
  // (code_edit.cpp:927-934) is a bare assignment.
  indent_use_spaces: v.boolean('indent_use_spaces'),
  // code_edit.cpp:3007 — BOOL, no hint. set_auto_indent_enabled
  // (code_edit.cpp:940-942) is a bare assignment.
  indent_automatic: v.boolean('indent_automatic'),
  // code_edit.cpp:3008 (see validator doc above).
  indent_automatic_prefixes: prefixArrayValidator('indent_automatic_prefixes', {
    truncationCite: 'code_edit.cpp:952',
  }),

  // Auto Brace Completion (ADD_GROUP "Auto Brace Completion",
  // "auto_brace_completion_", code_edit.cpp:3010-3013).
  // code_edit.cpp:3011 — BOOL, PROPERTY_HINT_GROUP_ENABLE. set_auto_brace_completion_enabled
  // (code_edit.cpp:1249-1251) is a bare assignment.
  auto_brace_completion_enabled: v.boolean('auto_brace_completion_enabled'),
  // code_edit.cpp:3012 — BOOL, no hint. set_highlight_matching_braces_enabled
  // (code_edit.cpp:1257-1260) is a bare assignment plus a redraw call.
  auto_brace_completion_highlight_matching: v.boolean('auto_brace_completion_highlight_matching'),
  // code_edit.cpp:3013 (see validator doc above).
  auto_brace_completion_pairs: bracePairsValidator('auto_brace_completion_pairs'),
});
