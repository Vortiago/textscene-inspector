/**
 * TextEdit strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. There is no genuine cross-field rule for TextEdit, so there
 * is no `linter.ts` / `linter.test.ts`.
 *
 * Grouped to match linterParser.ts's own grouping (and text_edit.cpp's
 * ADD_GROUP structure): one `describe` per group, one `it` per property
 * covering happy + malformed + any bound, rather than 47 near-identical cases.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('TextEdit', property);
  expect(validator, `no validator registered for TextEdit.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/** Every plain boolean property, grouped as linterParser.ts groups them. */
const BOOLEAN_PROPERTIES = [
  'editable',
  'context_menu_enabled',
  'emoji_menu_enabled',
  'backspace_deletes_composite_character_enabled',
  'shortcut_keys_enabled',
  'selecting_enabled',
  'deselect_on_focus_loss_enabled',
  'drag_and_drop_selection_enabled',
  'middle_mouse_paste_enabled',
  'empty_selection_clipboard_enabled',
  'indent_wrapped_lines',
  'tab_input_mode',
  'virtual_keyboard_enabled',
  'virtual_keyboard_show_on_focus',
  'scroll_smooth',
  'scroll_past_end_of_file',
  'scroll_fit_content_height',
  'scroll_fit_content_width',
  'minimap_draw',
  'caret_blink',
  'caret_draw_when_editable_disabled',
  'caret_move_on_right_click',
  'caret_mid_grapheme',
  'caret_multiple',
  'use_default_word_separators',
  'use_custom_word_separators',
  'highlight_all_occurrences',
  'highlight_current_line',
  'draw_control_chars',
  'draw_tabs',
  'draw_spaces',
];

describe('TextEdit strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('TextEdit')).not.toEqual([]);
  });

  it('registers all 47 of TextEdit own members (doc/classes/TextEdit.xml minus the 2 overrides=)', () => {
    expect(validatorRegistry.getOwnKeys('TextEdit')).toHaveLength(47);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property/per-group cases follow.
    const accepted = validatorRegistry
      .getOwnKeys('TextEdit')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('never re-declares focus_mode or mouse_default_cursor_shape (overrides="Control", owned by the ancestor)', () => {
    expect(validatorRegistry.getOwnKeys('TextEdit')).not.toContain('focus_mode');
    expect(validatorRegistry.getOwnKeys('TextEdit')).not.toContain('mouse_default_cursor_shape');
  });

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

  describe('text & placeholder (quoted strings)', () => {
    it('accepts a quoted text value', () => {
      expect(check('text', '"Hello, World!"')).toBeNull();
    });

    it('accepts the empty string', () => {
      expect(check('text', '""')).toBeNull();
    });

    it('rejects an unquoted value', () => {
      expect(check('text', 'Hello, World!')).not.toBeNull();
    });

    it('accepts a quoted placeholder_text value', () => {
      expect(check('placeholder_text', '"Type here…"')).toBeNull();
    });

    it('rejects an unquoted placeholder_text value', () => {
      expect(check('placeholder_text', 'Type here…')).not.toBeNull();
    });
  });

  describe('wrap_mode (enum 0-1)', () => {
    // text_edit.cpp:7402-7403: LINE_WRAPPING_NONE=0, LINE_WRAPPING_BOUNDARY=1.
    it('accepts 0 (LINE_WRAPPING_NONE, the documented default)', () => {
      expect(check('wrap_mode', '0')).toBeNull();
    });

    it('accepts 1 (LINE_WRAPPING_BOUNDARY)', () => {
      expect(check('wrap_mode', '1')).toBeNull();
    });

    it('rejects a value beyond the enum (2)', () => {
      expect(check('wrap_mode', '2')).not.toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('wrap_mode', '-1')).not.toBeNull();
    });
  });

  describe('autowrap_mode (enum 0-3, wider than the editor hint)', () => {
    // text_server.h:98-102: AUTOWRAP_OFF=0, AUTOWRAP_ARBITRARY=1, AUTOWRAP_WORD=2,
    // AUTOWRAP_WORD_SMART=3. The editor's PROPERTY_HINT_ENUM only offers 1-3
    // (text_edit.cpp:7559), but set_autowrap_mode has no clamp (text_edit.cpp:6354-6360).
    it('accepts 0 (AUTOWRAP_OFF, absent from the editor dropdown but unclamped)', () => {
      expect(check('autowrap_mode', '0')).toBeNull();
    });

    it('accepts 3 (AUTOWRAP_WORD_SMART, the documented default)', () => {
      expect(check('autowrap_mode', '3')).toBeNull();
    });

    it('rejects a value beyond the enum (4)', () => {
      expect(check('autowrap_mode', '4')).not.toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('autowrap_mode', '-1')).not.toBeNull();
    });
  });

  describe('scroll_v_scroll_speed (float >= 1)', () => {
    // text_edit.cpp:6488-6489: ERR_FAIL_COND(p_speed < 1.0).
    it('accepts the documented default (80.0)', () => {
      expect(check('scroll_v_scroll_speed', '80.0')).toBeNull();
    });

    it('accepts the lower bound (1.0)', () => {
      expect(check('scroll_v_scroll_speed', '1.0')).toBeNull();
    });

    it('rejects a value below 1', () => {
      expect(check('scroll_v_scroll_speed', '0.5')).not.toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('scroll_v_scroll_speed', 'fast')).not.toBeNull();
    });
  });

  describe('scroll_vertical (float >= 0)', () => {
    // range.h:40,46 + range.cpp:196-198: the internal VScrollBar clamps below
    // its min (0.0, allow_lesser=false) before a value could ever be saved.
    it('accepts the documented default (0.0)', () => {
      expect(check('scroll_vertical', '0.0')).toBeNull();
    });

    it('accepts a positive value', () => {
      expect(check('scroll_vertical', '12.5')).toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('scroll_vertical', '-1.0')).not.toBeNull();
    });
  });

  describe('scroll_horizontal (integer >= 0)', () => {
    // text_edit.cpp:6476-6480: set_h_scroll clamps p_scroll < 0 to 0.
    it('accepts the documented default (0)', () => {
      expect(check('scroll_horizontal', '0')).toBeNull();
    });

    it('accepts a positive value', () => {
      expect(check('scroll_horizontal', '40')).toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('scroll_horizontal', '-1')).not.toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('scroll_horizontal', 'wide')).not.toBeNull();
    });
  });

  describe('minimap_width (unconstrained integer)', () => {
    // text_edit.cpp:6690-6696: set_minimap_width stores the int with no clamp.
    it('accepts the documented default (80)', () => {
      expect(check('minimap_width', '80')).toBeNull();
    });

    it('accepts 0', () => {
      expect(check('minimap_width', '0')).toBeNull();
    });

    it('rejects a non-integer value', () => {
      expect(check('minimap_width', 'wide')).not.toBeNull();
    });
  });

  describe('caret_type (enum 0-1)', () => {
    // text_edit.cpp:7293-7294: CARET_TYPE_LINE=0, CARET_TYPE_BLOCK=1.
    it('accepts 0 (CARET_TYPE_LINE, the documented default)', () => {
      expect(check('caret_type', '0')).toBeNull();
    });

    it('accepts 1 (CARET_TYPE_BLOCK)', () => {
      expect(check('caret_type', '1')).toBeNull();
    });

    it('rejects a value beyond the enum (2)', () => {
      expect(check('caret_type', '2')).not.toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('caret_type', '-1')).not.toBeNull();
    });
  });

  describe('caret_blink_interval (float > 0)', () => {
    // text_edit.cpp:5197-5199: ERR_FAIL_COND(p_interval <= 0). The
    // PROPERTY_HINT_RANGE "0.1,10,0.01" ceiling is an editor slider only.
    it('accepts the documented default (0.65)', () => {
      expect(check('caret_blink_interval', '0.65')).toBeNull();
    });

    it('accepts a value past the editor slider ceiling of 10', () => {
      expect(check('caret_blink_interval', '15')).toBeNull();
    });

    it('rejects 0', () => {
      expect(check('caret_blink_interval', '0')).not.toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('caret_blink_interval', '-0.5')).not.toBeNull();
    });
  });

  describe('custom_word_separators / language (quoted strings)', () => {
    it('accepts a quoted custom_word_separators value', () => {
      expect(check('custom_word_separators', '".,;:!?"')).toBeNull();
    });

    it('accepts the empty string default', () => {
      expect(check('custom_word_separators', '""')).toBeNull();
    });

    it('rejects an unquoted custom_word_separators value', () => {
      expect(check('custom_word_separators', '.,;:!?')).not.toBeNull();
    });

    it('accepts a quoted language value', () => {
      expect(check('language', '"en"')).toBeNull();
    });

    it('rejects an unquoted language value', () => {
      expect(check('language', 'en')).not.toBeNull();
    });
  });

  describe('syntax_highlighter (resource reference)', () => {
    it('accepts a SubResource reference', () => {
      expect(check('syntax_highlighter', 'SubResource("CodeHighlighter_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('syntax_highlighter', 'ExtResource("1")')).toBeNull();
    });

    it('rejects a plain string', () => {
      expect(check('syntax_highlighter', '"not a resource"')).not.toBeNull();
    });
  });

  describe('text_direction (enum -1-3)', () => {
    // control.cpp:4415-4418: TEXT_DIRECTION_AUTO=0, _LTR=1, _RTL=2, _INHERITED=3.
    it('accepts 0 (TEXT_DIRECTION_AUTO, the documented default)', () => {
      expect(check('text_direction', '0')).toBeNull();
    });

    it('accepts 3 (TEXT_DIRECTION_INHERITED)', () => {
      expect(check('text_direction', '3')).toBeNull();
    });

    it('accepts -1, a legacy value with no named constant that the ERR_FAIL_COND (text_edit.cpp:3724) still allows', () => {
      expect(check('text_direction', '-1')).toBeNull();
    });

    it('rejects a value beyond the enum (4)', () => {
      expect(check('text_direction', '4')).not.toBeNull();
    });

    it('rejects -2, past the ERR_FAIL_COND on the other side', () => {
      expect(check('text_direction', '-2')).not.toBeNull();
    });
  });

  describe('structured_text_bidi_override (enum 0-6)', () => {
    // text_server.cpp:681-687: STRUCTURED_TEXT_DEFAULT=0 .. STRUCTURED_TEXT_CUSTOM=6.
    it('accepts 0 (STRUCTURED_TEXT_DEFAULT, the documented default)', () => {
      expect(check('structured_text_bidi_override', '0')).toBeNull();
    });

    it('accepts 6 (STRUCTURED_TEXT_CUSTOM)', () => {
      expect(check('structured_text_bidi_override', '6')).toBeNull();
    });

    it('rejects a value beyond the enum (7)', () => {
      expect(check('structured_text_bidi_override', '7')).not.toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('structured_text_bidi_override', '-1')).not.toBeNull();
    });
  });

  describe('structured_text_bidi_override_options (Array literal)', () => {
    it('accepts the empty-array default', () => {
      expect(check('structured_text_bidi_override_options', '[]')).toBeNull();
    });

    it('accepts a populated array', () => {
      expect(check('structured_text_bidi_override_options', '[0, 5]')).toBeNull();
    });

    it('rejects a value not wrapped in brackets', () => {
      expect(check('structured_text_bidi_override_options', '0, 5')).not.toBeNull();
    });

    it('rejects a resource reference', () => {
      expect(check('structured_text_bidi_override_options', 'SubResource("Foo_1")')).not.toBeNull();
    });
  });
});
