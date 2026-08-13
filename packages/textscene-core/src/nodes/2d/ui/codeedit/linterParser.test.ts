/**
 * CodeEdit strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour (the cross-property delimiter-key
 * collision) belongs in linter.test.ts, through the rule object directly.
 *
 * Grouped to match linterParser.ts's own grouping (CodeEdit::_bind_methods's
 * ADD_GROUP structure, code_edit.cpp:2977-3013): an ungrouped run, then
 * Gutters, Delimiters, Code Completion, Indentation, and Auto Brace
 * Completion.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('CodeEdit', property);
  expect(validator, `no validator registered for CodeEdit.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The 22 own members doc/classes/CodeEdit.xml lists without an `overrides=`
 * attribute (`layout_direction` overrides Control, `text_direction` overrides
 * TextEdit — both are default-value overrides only, never re-declared with
 * `ADD_PROPERTY` in code_edit.cpp).
 */
const KEYS: string[] = [
  'symbol_lookup_on_click',
  'symbol_tooltip_on_hover',
  'line_folding',
  'line_length_guidelines',
  'gutters_draw_breakpoints_gutter',
  'gutters_draw_bookmarks',
  'gutters_draw_executing_lines',
  'gutters_draw_line_numbers',
  'gutters_zero_pad_line_numbers',
  'gutters_line_numbers_min_digits',
  'gutters_draw_fold_gutter',
  'delimiter_strings',
  'delimiter_comments',
  'code_completion_enabled',
  'code_completion_prefixes',
  'indent_size',
  'indent_use_spaces',
  'indent_automatic',
  'indent_automatic_prefixes',
  'auto_brace_completion_enabled',
  'auto_brace_completion_highlight_matching',
  'auto_brace_completion_pairs',
];
const DECLARES_NOTHING = false;

describe('CodeEdit strict validators', () => {
  it('registers exactly what CodeEdit binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('CodeEdit').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    expectFixtureClean('unit-code-edit.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    const accepted = validatorRegistry
      .getOwnKeys('CodeEdit')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('never re-declares layout_direction (overrides="Control") or text_direction (overrides="TextEdit")', () => {
    expect(validatorRegistry.getOwnKeys('CodeEdit')).not.toContain('layout_direction');
    expect(validatorRegistry.getOwnKeys('CodeEdit')).not.toContain('text_direction');
  });

  it('resolves inherited keys through the base-walk', () => {
    // TextEdit, Control and CanvasItem keys must reach a CodeEdit without
    // being re-declared here.
    expect(validatorRegistry.findValidator('CodeEdit', 'text')).not.toBeNull();
    expect(validatorRegistry.findValidator('CodeEdit', 'anchor_right')).not.toBeNull();
    expect(validatorRegistry.findValidator('CodeEdit', 'modulate')).not.toBeNull();
  });

  const BOOLEAN_PROPERTIES = [
    'symbol_lookup_on_click',
    'symbol_tooltip_on_hover',
    'line_folding',
    'gutters_draw_breakpoints_gutter',
    'gutters_draw_bookmarks',
    'gutters_draw_executing_lines',
    'gutters_draw_line_numbers',
    'gutters_zero_pad_line_numbers',
    'gutters_draw_fold_gutter',
    'code_completion_enabled',
    'indent_use_spaces',
    'indent_automatic',
    'auto_brace_completion_enabled',
    'auto_brace_completion_highlight_matching',
  ];

  describe.each(BOOLEAN_PROPERTIES)('%s (boolean)', (property) => {
    it('accepts true', () => {
      expect(check(property, 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check(property, 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check(property, 'yes')).not.toBeNull();
    });
  });

  describe('line_length_guidelines (int array, unconstrained)', () => {
    // code_edit.cpp:2499-2502: set_line_length_guidelines stores the array
    // verbatim, no per-element check.
    it('accepts the empty-array default', () => {
      expect(check('line_length_guidelines', 'PackedInt32Array()')).toBeNull();
    });

    it('accepts a populated array', () => {
      expect(check('line_length_guidelines', 'PackedInt32Array(80, 120)')).toBeNull();
    });

    it('accepts a negative value (nothing in the setter refuses one)', () => {
      expect(check('line_length_guidelines', 'PackedInt32Array(-1)')).toBeNull();
    });

    it('accepts the Array[int]([...]) form Godot actually serialises', () => {
      // The setter/getter are TypedArray<int> (code_edit.cpp:2499/:2504) even
      // though ADD_PROPERTY declares PACKED_INT32_ARRAY, so the serializer takes
      // the is_typed() branch. scenes/demos/gui/control_gallery carries this.
      expect(check('line_length_guidelines', 'Array[int]([24])')).toBeNull();
    });

    it('accepts a bare array literal', () => {
      expect(check('line_length_guidelines', '[80, 120]')).toBeNull();
    });

    it('rejects a value that is not any array form', () => {
      expect(check('line_length_guidelines', '80, 120')).not.toBeNull();
    });

    // Both spellings narrow a float rather than refusing it: the packed form
    // through `_parse_construct<int32_t>` (variant_parser.cpp:1428-1430), the
    // typed form through `ContainerTypeValidate`, which converts an element
    // whose type `can_convert_strict`s to the array's — and FLOAT does, to INT.
    it('truncates a float element in the typed form', () => {
      expect(check('line_length_guidelines', 'Array[int]([80.5])')).toBeNull();
    });

    it('truncates a float element in the packed form', () => {
      expect(check('line_length_guidelines', 'PackedInt32Array(80.5)')).toBeNull();
    });

    it('still rejects an element Godot cannot tokenise at all', () => {
      expect(check('line_length_guidelines', 'PackedInt32Array(80abc)')).not.toBeNull();
    });
  });

  describe('the typed-array spelling Godot writes for every string array', () => {
    // delimiter_strings, delimiter_comments, code_completion_prefixes and
    // indent_automatic_prefixes all declare PACKED_STRING_ARRAY but have
    // TypedArray<String> getters (code_edit.cpp:2036, :2065, :2222, :956), and
    // the getter is what the serializer sees. Accepting only the declared
    // spelling would reject a scene Godot itself wrote.
    it.each([
      ['delimiter_strings', 'Array[String](["< >"])'],
      ['delimiter_comments', 'Array[String](["#"])'],
      ['code_completion_prefixes', 'Array[String](["."])'],
      ['indent_automatic_prefixes', 'Array[String]([":"])'],
    ])('%s accepts the Array[String]([...]) form', (property, value) => {
      expect(check(property, value)).toBeNull();
    });

    it('still accepts the declared PackedStringArray spelling', () => {
      expect(check('code_completion_prefixes', 'PackedStringArray(".")')).toBeNull();
    });

    it('accepts an empty typed array', () => {
      expect(check('code_completion_prefixes', 'Array[String]([])')).toBeNull();
    });

    it('still applies the per-element rule inside the typed form', () => {
      // A multi-character prefix is truncated by the setter (code_edit.cpp:2218),
      // so the new spelling must not become an escape hatch from the check.
      expect(check('code_completion_prefixes', 'Array[String]([".."])')).not.toBeNull();
    });

    it('rejects a non-array value', () => {
      expect(check('code_completion_prefixes', '"."')).not.toBeNull();
    });
  });

  describe('gutters_line_numbers_min_digits (int 1-5, hinted)', () => {
    // code_edit.cpp:2992: PROPERTY_HINT_RANGE "1,5,1", no or_greater/or_less.
    // set_line_numbers_min_digits (code_edit.cpp:1537-1551) never clamps.
    it('accepts the documented default (3)', () => {
      expect(check('gutters_line_numbers_min_digits', '3')).toBeNull();
    });

    it('accepts the lower bound (1)', () => {
      expect(check('gutters_line_numbers_min_digits', '1')).toBeNull();
    });

    it('accepts the upper bound (5)', () => {
      expect(check('gutters_line_numbers_min_digits', '5')).toBeNull();
    });

    it('warns below the hinted floor (0), since only the hint says so', () => {
      const error = check('gutters_line_numbers_min_digits', '0');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('warns above the hinted ceiling (6)', () => {
      const error = check('gutters_line_numbers_min_digits', '6');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });
  });

  describe('delimiter_strings / delimiter_comments (symbol-only start[ end] keys)', () => {
    it('accepts the documented default string delimiters (quote pairs)', () => {
      expect(check('delimiter_strings', 'PackedStringArray("\' \'", "\\" \\"")')).toBeNull();
    });

    it('accepts a line-comment delimiter with no end key', () => {
      expect(check('delimiter_comments', 'PackedStringArray("# ")')).toBeNull();
    });

    it('accepts the empty-array default', () => {
      expect(check('delimiter_comments', 'PackedStringArray()')).toBeNull();
    });

    it('skips a wholly empty element with no error (silently dropped, not validated)', () => {
      expect(check('delimiter_comments', 'PackedStringArray("")')).toBeNull();
    });

    it('rejects a value that is not any array form', () => {
      expect(check('delimiter_strings', '"x"')).not.toBeNull();
    });

    it('rejects an empty start key (a leading space before any content)', () => {
      const error = check('delimiter_comments', 'PackedStringArray(" x")');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });

    it('rejects a start key with a non-symbol (alphanumeric) character', () => {
      const error = check('delimiter_comments', 'PackedStringArray("rem")');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });

    it('rejects an end key with a non-symbol character', () => {
      const error = check('delimiter_strings', 'PackedStringArray("\' end")');
      expect(error).not.toBeNull();
    });

    it('rejects a start key repeated within the same array', () => {
      const error = check('delimiter_comments', 'PackedStringArray("# ", "#")');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });
  });

  describe('code_completion_prefixes (single-character elements, empty refused)', () => {
    it('accepts single-character prefixes', () => {
      expect(check('code_completion_prefixes', 'PackedStringArray(".", "$")')).toBeNull();
    });

    it('accepts the empty-array default', () => {
      expect(check('code_completion_prefixes', 'PackedStringArray()')).toBeNull();
    });

    it('rejects an empty-string element (ERR_CONTINUE_MSG, code_edit.cpp:2217)', () => {
      const error = check('code_completion_prefixes', 'PackedStringArray("")');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });

    it('rejects a multi-character element (silently truncated, code_edit.cpp:2218)', () => {
      const error = check('code_completion_prefixes', 'PackedStringArray("->")');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });

    it('rejects a value that is not any array form', () => {
      expect(check('code_completion_prefixes', '"x"')).not.toBeNull();
    });
  });

  describe('indent_size (int >= 1, enforced)', () => {
    // code_edit.cpp:908-921: ERR_FAIL_COND_MSG(p_size <= 0, …).
    it('accepts the documented default (4)', () => {
      expect(check('indent_size', '4')).toBeNull();
    });

    it('accepts the lower bound (1)', () => {
      expect(check('indent_size', '1')).toBeNull();
    });

    it('rejects 0', () => {
      const error = check('indent_size', '0');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });

    it('rejects a negative value', () => {
      const error = check('indent_size', '-4');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });

    it('rejects a non-integer value', () => {
      expect(check('indent_size', 'four')).not.toBeNull();
    });
  });

  describe('indent_automatic_prefixes (single-character elements, empty unflagged)', () => {
    it('accepts the documented default', () => {
      expect(check('indent_automatic_prefixes', 'PackedStringArray(":", "{", "[", "(")')).toBeNull();
    });

    it('accepts the empty-array default', () => {
      expect(check('indent_automatic_prefixes', 'PackedStringArray()')).toBeNull();
    });

    it('accepts an empty-string element (no guard in the source, unlike code_completion_prefixes)', () => {
      expect(check('indent_automatic_prefixes', 'PackedStringArray("")')).toBeNull();
    });

    it('rejects a multi-character element (silently truncated, code_edit.cpp:952)', () => {
      const error = check('indent_automatic_prefixes', 'PackedStringArray("::")');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });
  });

  describe('auto_brace_completion_pairs (Dictionary of symbol-only string pairs)', () => {
    it('accepts the documented default', () => {
      expect(
        check(
          'auto_brace_completion_pairs',
          '{ "\\"": "\\"", "\'": "\'", "(": ")", "[": "]", "{": "}" }'
        )
      ).toBeNull();
    });

    it('accepts the empty dictionary', () => {
      expect(check('auto_brace_completion_pairs', '{}')).toBeNull();
    });

    it('rejects a value not wrapped in curly braces', () => {
      expect(check('auto_brace_completion_pairs', 'PackedStringArray("(", ")")')).not.toBeNull();
    });

    it('rejects an empty open key', () => {
      const error = check('auto_brace_completion_pairs', '{ "": ")" }');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });

    it('rejects an empty close key', () => {
      const error = check('auto_brace_completion_pairs', '{ "(": "" }');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });

    it('rejects an open key with a non-symbol character', () => {
      const error = check('auto_brace_completion_pairs', '{ "ab": ")" }');
      expect(error).not.toBeNull();
    });

    it('rejects a close key with a non-symbol character', () => {
      const error = check('auto_brace_completion_pairs', '{ "(": "cd" }');
      expect(error).not.toBeNull();
    });
  });
});
