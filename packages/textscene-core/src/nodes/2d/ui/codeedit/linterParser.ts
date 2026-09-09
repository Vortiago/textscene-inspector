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
 *
 * The four hand-rolled validators live beside this file — `delimiterValidators`,
 * `prefixValidators`, `bracePairValidators`, and the array parses they share in
 * `arrayForms` — so this one stays the annotated map of what CodeEdit declares.
 */

import '../textedit/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { accepts, propertyError, v } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { arrayBody, INT_ARRAY_FORMS, PACKED_INT32_ARRAY_RE } from './arrayForms.js';
import { bracePairsValidator } from './bracePairValidators.js';
import { delimiterArrayValidator } from './delimiterValidators.js';
import { prefixArrayValidator } from './prefixValidators.js';
import { markIntSlot } from '../../../../linter/validators/intSlot.js';
import { badIntElement } from '../../../../linter/validators/v/packedArrays.js';

/**
 * `line_length_guidelines` — `set_line_length_guidelines`
 * (code_edit.cpp:2499-2502) stores the array verbatim with no per-element check
 * at all (no clamp, no sort, no uniqueness requirement), so this carries no
 * bound of its own — mirroring `SplitContainer.split_offsets`
 * (nodes/2d/ui/splitcontainer/linterParser.ts), which is the same shape.
 *
 * The element WIDTH is per-spelling, not per-slot. Setter and getter are
 * `TypedArray<int>` (code_edit.h:505-506, code_edit.cpp:2499-2506) behind
 * `PropertyInfo(Variant::PACKED_INT32_ARRAY, …)` (code_edit.cpp:2981), so the
 * packed constructor narrows to int32 on the way in
 * (`_parse_construct<int32_t>`, variant_parser.cpp:1428-1430) and the other two
 * forms reach the setter as int64 elements. See {@link PACKED_INT32_ARRAY_RE}.
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
    // One pass: unreadable by the tokenizer, or read and then narrowed away —
    // at the width the MATCHED spelling converts through.
    const bad = badIntElement(
      'line_length_guidelines',
      key,
      line,
      body,
      { format: code, value: 'INVALID_LINE_LENGTH_GUIDELINES_VALUE' },
      PACKED_INT32_ARRAY_RE.test(value) ? 'int32' : 'int64'
    );
    return bad.error ?? bad.truncated;
  }, 'int array (PackedInt32Array(…), Array[int]([…]) or […])');
  // An INT slot, not format-only: it rejects a literal the tokenizer reads.
  // The tag carries int32, the width of the `PackedInt32Array` spelling the
  // `nonFiniteInts` sweep probes with; the validator picks per spelling above,
  // which no single tag can express.
  return markIntSlot(validator);
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
