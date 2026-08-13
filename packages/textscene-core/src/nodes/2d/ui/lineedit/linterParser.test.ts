/**
 * LineEdit strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing. There is no genuine cross-field rule for
 * LineEdit, so there is no `linter.ts` / `linter.test.ts`.
 *
 * Grouped to match linterParser.ts's own grouping (and line_edit.cpp's
 * ADD_GROUP structure): one `describe` per group, one `it` per property
 * covering happy + malformed + any bound, rather than 36 near-identical cases.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('LineEdit', property);
  expect(validator, `no validator registered for LineEdit.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/** Every plain boolean property, grouped as linterParser.ts groups them. */
const BOOLEAN_PROPERTIES = [
  'editable',
  'keep_editing_on_text_submit',
  'expand_to_text_length',
  'context_menu_enabled',
  'emoji_menu_enabled',
  'backspace_deletes_composite_character_enabled',
  'clear_button_enabled',
  'shortcut_keys_enabled',
  'middle_mouse_paste_enabled',
  'selecting_enabled',
  'deselect_on_focus_loss_enabled',
  'drag_and_drop_selection_enabled',
  'flat',
  'draw_control_chars',
  'select_all_on_focus',
  'virtual_keyboard_enabled',
  'virtual_keyboard_show_on_focus',
  'caret_blink',
  'caret_force_displayed',
  'caret_mid_grapheme',
  'secret',
];

describe('LineEdit strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('LineEdit')).not.toEqual([]);
  });

  it('registers exactly the 36 own members doc/classes/LineEdit.xml lists without an overrides= attribute', () => {
    expect(validatorRegistry.getOwnKeys('LineEdit').sort()).toEqual([
      'alignment',
      'backspace_deletes_composite_character_enabled',
      'caret_blink',
      'caret_blink_interval',
      'caret_column',
      'caret_force_displayed',
      'caret_mid_grapheme',
      'clear_button_enabled',
      'context_menu_enabled',
      'deselect_on_focus_loss_enabled',
      'drag_and_drop_selection_enabled',
      'draw_control_chars',
      'editable',
      'emoji_menu_enabled',
      'expand_to_text_length',
      'flat',
      'icon_expand_mode',
      'keep_editing_on_text_submit',
      'language',
      'max_length',
      'middle_mouse_paste_enabled',
      'placeholder_text',
      'right_icon',
      'right_icon_scale',
      'secret',
      'secret_character',
      'select_all_on_focus',
      'selecting_enabled',
      'shortcut_keys_enabled',
      'structured_text_bidi_override',
      'structured_text_bidi_override_options',
      'text',
      'text_direction',
      'virtual_keyboard_enabled',
      'virtual_keyboard_show_on_focus',
      'virtual_keyboard_type',
    ]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property/per-group cases follow.
    const accepted = validatorRegistry
      .getOwnKeys('LineEdit')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('never re-declares focus_mode or mouse_default_cursor_shape (overrides="Control", owned by the ancestor)', () => {
    expect(validatorRegistry.getOwnKeys('LineEdit')).not.toContain('focus_mode');
    expect(validatorRegistry.getOwnKeys('LineEdit')).not.toContain('mouse_default_cursor_shape');
  });

  it('resolves inherited keys through the base-walk without re-declaring them', () => {
    expect(validatorRegistry.findValidator('LineEdit', 'anchor_right')).not.toBeNull();
    expect(validatorRegistry.findValidator('LineEdit', 'modulate')).not.toBeNull();
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

  describe('text & placeholder_text (quoted strings)', () => {
    it('accepts a quoted text value', () => {
      expect(check('text', '"Ada Lovelace"')).toBeNull();
    });

    it('accepts the empty string default', () => {
      expect(check('text', '""')).toBeNull();
    });

    it('rejects an unquoted value', () => {
      expect(check('text', 'Ada Lovelace')).not.toBeNull();
    });

    it('accepts a quoted placeholder_text value', () => {
      expect(check('placeholder_text', '"Enter text here..."')).toBeNull();
    });

    it('rejects an unquoted placeholder_text value', () => {
      expect(check('placeholder_text', 'Enter text here...')).not.toBeNull();
    });
  });

  describe('alignment (enum 0-3, enforced)', () => {
    // line_edit.cpp:1072 — ERR_FAIL_INDEX((int)p_alignment, 4): rejects >= 4.
    it('accepts 0 (LEFT, the documented default)', () => {
      expect(check('alignment', '0')).toBeNull();
    });

    it('accepts 1 (CENTER), which the unit-lineedit fixture uses', () => {
      expect(check('alignment', '1')).toBeNull();
    });

    it('accepts 3 (FILL), the last labelled entry', () => {
      expect(check('alignment', '3')).toBeNull();
    });

    it('rejects 4, past the ERR_FAIL_INDEX', () => {
      expect(check('alignment', '4')).not.toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('alignment', '-1')).not.toBeNull();
    });
  });

  describe('max_length (integer >= 0)', () => {
    // line_edit.cpp:2521 — ERR_FAIL_COND(p_max_length < 0); hint's "or_greater"
    // opens the ceiling.
    it('accepts the documented default (0, meaning unlimited)', () => {
      expect(check('max_length', '0')).toBeNull();
    });

    it('accepts a value past the editor hint ceiling of 1000', () => {
      expect(check('max_length', '5000')).toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('max_length', '-1')).not.toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('max_length', 'unlimited')).not.toBeNull();
    });
  });

  describe('virtual_keyboard_type (enum 0-7, hinted)', () => {
    it('accepts 0 (KEYBOARD_TYPE_DEFAULT, the documented default)', () => {
      expect(check('virtual_keyboard_type', '0')).toBeNull();
    });

    it('accepts 7 (KEYBOARD_TYPE_URL), the last entry', () => {
      expect(check('virtual_keyboard_type', '7')).toBeNull();
    });

    it('rejects a value beyond the enum (8)', () => {
      expect(check('virtual_keyboard_type', '8')).not.toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('virtual_keyboard_type', '-1')).not.toBeNull();
    });
  });

  describe('caret_blink_interval (setter refuses <= 0, hint states 0.1 to 10)', () => {
    // line_edit.cpp:2050 — ERR_FAIL_COND(p_interval <= 0). The
    // PROPERTY_HINT_RANGE "0.1,10,0.01" (line_edit.cpp:3510) is an editor
    // slider the setter never applies, so both of its ends warn.
    it('accepts the documented default (0.65)', () => {
      expect(check('caret_blink_interval', '0.65')).toBeNull();
    });

    it('accepts the hint floor of 0.1 and its ceiling of 10', () => {
      expect(check('caret_blink_interval', '0.1')).toBeNull();
      expect(check('caret_blink_interval', '10')).toBeNull();
    });

    it('warns, not errors, past the ceiling', () => {
      const error = check('caret_blink_interval', '10.01');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('warning');
      expect(error!.message).toContain('between 0.1 and 10');
    });

    it('warns between the refused floor and the hinted one', () => {
      const warning = check('caret_blink_interval', '0.05');
      expect(warning).not.toBeNull();
      expect(warning!.severity).toBe('warning');
      expect(warning!.message).toContain('between 0.1 and 10');
    });

    it('errors on 0, which the setter refuses', () => {
      const error = check('caret_blink_interval', '0');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('error');
      expect(error!.message).toContain('greater than 0');
    });

    it('errors on a negative value', () => {
      const error = check('caret_blink_interval', '-0.5');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('error');
    });
  });

  describe('caret_column (integer >= 0, floor enforced)', () => {
    // line_edit.cpp:2277-2279 clamps below 0 up to 0; the ceiling clamps to
    // text.length(), a sibling-property bound this validator cannot see.
    it('accepts the documented default (0)', () => {
      expect(check('caret_column', '0')).toBeNull();
    });

    it('accepts a value past the editor hint ceiling of 1000 (no ceiling enforced here)', () => {
      expect(check('caret_column', '5000')).toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('caret_column', '-1')).not.toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('caret_column', 'first')).not.toBeNull();
    });
  });

  describe('secret_character (quoted string, at most one character, enforced)', () => {
    // line_edit.cpp:2610-2612: length > 1 truncates to the first character
    // after a WARN_PRINT rather than being rejected outright, so a longer
    // literal is a value ERROR (the setter alters it) rather than a format one.
    it('accepts the documented default bullet ("•")', () => {
      expect(check('secret_character', '"•"')).toBeNull();
    });

    it('accepts a single ASCII character', () => {
      expect(check('secret_character', '"*"')).toBeNull();
    });

    it('accepts an empty string: length 0 is not > 1', () => {
      expect(check('secret_character', '""')).toBeNull();
    });

    it('rejects an unquoted value', () => {
      expect(check('secret_character', '*')).not.toBeNull();
    });

    it('rejects more than one character: set_secret_character (line_edit.cpp:2608-2621) silently truncates to the first character rather than accepting the literal as written', () => {
      expect(check('secret_character', '"ab"')).not.toBeNull();
    });
  });

  describe('text_direction (enum -1..3, enforced)', () => {
    // line_edit.cpp:2156 — ERR_FAIL_COND((int)p_text_direction < -1 || > 3).
    it('accepts 0 (TEXT_DIRECTION_AUTO, the documented default)', () => {
      expect(check('text_direction', '0')).toBeNull();
    });

    it('accepts 3 (TEXT_DIRECTION_INHERITED)', () => {
      expect(check('text_direction', '3')).toBeNull();
    });

    it('accepts -1, a legacy value with no named constant that the ERR_FAIL_COND still allows', () => {
      expect(check('text_direction', '-1')).toBeNull();
    });

    it('rejects a value beyond the enum (4)', () => {
      expect(check('text_direction', '4')).not.toBeNull();
    });

    it('rejects -2, past the ERR_FAIL_COND on the other side', () => {
      expect(check('text_direction', '-2')).not.toBeNull();
    });
  });

  describe('language (quoted string)', () => {
    it('accepts a locale id', () => {
      expect(check('language', '"en"')).toBeNull();
    });

    it('accepts the empty string default', () => {
      expect(check('language', '""')).toBeNull();
    });

    it('rejects an unquoted value', () => {
      expect(check('language', 'en')).not.toBeNull();
    });
  });

  describe('structured_text_bidi_override (enum 0-6, hinted)', () => {
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

  describe('right_icon (resource reference)', () => {
    it('accepts a SubResource reference', () => {
      expect(check('right_icon', 'SubResource("ImageTexture_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('right_icon', 'ExtResource("1_icon")')).toBeNull();
    });

    it('rejects a bare path', () => {
      expect(check('right_icon', '"res://icon.png"')).not.toBeNull();
    });
  });

  describe('icon_expand_mode (enum 0-2, hinted)', () => {
    it('accepts 0 (EXPAND_MODE_ORIGINAL_SIZE, the documented default)', () => {
      expect(check('icon_expand_mode', '0')).toBeNull();
    });

    it('accepts 2 (EXPAND_MODE_FIT_TO_LINE_EDIT), the last entry', () => {
      expect(check('icon_expand_mode', '2')).toBeNull();
    });

    it('rejects a value beyond the enum (3)', () => {
      expect(check('icon_expand_mode', '3')).not.toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('icon_expand_mode', '-1')).not.toBeNull();
    });
  });

  describe('right_icon_scale (float 0.1-1.0, hinted both ends)', () => {
    // line_edit.cpp:3528 — PROPERTY_HINT_RANGE "0.1,1.0,0.01", neither
    // or_greater nor or_less, and the setter enforces neither end.
    it('accepts the documented default (1.0)', () => {
      expect(check('right_icon_scale', '1.0')).toBeNull();
    });

    it('accepts the hint floor (0.1)', () => {
      expect(check('right_icon_scale', '0.1')).toBeNull();
    });

    it('rejects a value below the hint floor', () => {
      expect(check('right_icon_scale', '0.05')).not.toBeNull();
    });

    it('rejects a value above the hint ceiling', () => {
      expect(check('right_icon_scale', '1.5')).not.toBeNull();
    });
  });

  it('lints the unit-lineedit fixture clean', () => {
    expectFixtureClean('unit-lineedit.tscn');
  });
});
