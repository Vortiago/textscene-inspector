/**
 * RichTextLabel strict validators: format and range checks, asserted through
 * `validatorRegistry` so a failure points at the validator, not at scene parsing.
 * One `describe` per rich_text_label.cpp ADD_GROUP. `expectFixtureClean` runs
 * the real `StrictTscnParser` over the fixture.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import { checkerFor, expectError, expectWarning } from '../../../../linter/testing/validatorCheck';
import './linterParser';

/** `RichTextLabel.<property>`'s registered validator, invoked at line 1. */
const check = checkerFor('RichTextLabel');

/** Every plain boolean property, grouped as linterParser.ts groups them. */
const BOOLEAN_PROPERTIES = [
  'bbcode_enabled',
  'fit_content',
  'scroll_active',
  'scroll_following',
  'scroll_following_visible_characters',
  'context_menu_enabled',
  'shortcut_keys_enabled',
  'meta_underlined',
  'hint_underlined',
  'threaded',
  'selection_enabled',
  'deselect_on_focus_loss_enabled',
  'drag_and_drop_selection_enabled',
];

describe('RichTextLabel strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('RichTextLabel')).not.toEqual([]);
  });

  it('registers exactly the 30 own members (doc/classes/RichTextLabel.xml minus clip_contents and focus_mode, both overrides="Control")', () => {
    expect([...validatorRegistry.getOwnKeys('RichTextLabel')].sort()).toEqual(
      [
        'bbcode_enabled',
        'text',
        'fit_content',
        'scroll_active',
        'scroll_following',
        'scroll_following_visible_characters',
        'autowrap_mode',
        'autowrap_trim_flags',
        'tab_size',
        'context_menu_enabled',
        'shortcut_keys_enabled',
        'horizontal_alignment',
        'vertical_alignment',
        'justification_flags',
        'tab_stops',
        'custom_effects',
        'meta_underlined',
        'hint_underlined',
        'threaded',
        'progress_bar_delay',
        'selection_enabled',
        'deselect_on_focus_loss_enabled',
        'drag_and_drop_selection_enabled',
        'visible_characters',
        'visible_characters_behavior',
        'visible_ratio',
        'text_direction',
        'language',
        'structured_text_bidi_override',
        'structured_text_bidi_override_options',
      ].sort()
    );
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format.
    const accepted = validatorRegistry
      .getOwnKeys('RichTextLabel')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('never re-declares clip_contents or focus_mode (overrides="Control", owned by the ancestor)', () => {
    expect(validatorRegistry.getOwnKeys('RichTextLabel')).not.toContain('clip_contents');
    expect(validatorRegistry.getOwnKeys('RichTextLabel')).not.toContain('focus_mode');
  });

  it('resolves inherited keys through the base-walk', () => {
    // Control and CanvasItem keys must reach a RichTextLabel without being
    // re-declared here.
    expect(validatorRegistry.findValidator('RichTextLabel', 'anchor_right')).not.toBeNull();
    expect(validatorRegistry.findValidator('RichTextLabel', 'modulate')).not.toBeNull();
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

  describe('text (quoted string)', () => {
    it('accepts a quoted BBCode value', () => {
      expect(check('text', '"[b]Bold[/b] text"')).toBeNull();
    });

    it('accepts the empty string', () => {
      expect(check('text', '""')).toBeNull();
    });

    it('rejects an unquoted value', () => {
      expect(check('text', 'Bold text')).not.toBeNull();
    });
  });

  describe('autowrap_mode (enum 0-3, hinted)', () => {
    // rich_text_label.cpp:7761: "Off,Arbitrary,Word,Word (Smart)", the full
    // enum, unlike the Button and TextEdit hints, which omit AUTOWRAP_OFF.
    it('accepts 0 (AUTOWRAP_OFF)', () => {
      expect(check('autowrap_mode', '0')).toBeNull();
    });

    it('accepts 3 (AUTOWRAP_WORD_SMART, the documented default)', () => {
      expect(check('autowrap_mode', '3')).toBeNull();
    });

    it('warns past the enum (4)', () => {
      expectWarning(check('autowrap_mode', '4'), 'must be 0-3');
    });

    it('warns on a negative value', () => {
      expectWarning(check('autowrap_mode', '-1'), 'must be 0-3');
    });
  });

  describe('autowrap_trim_flags', () => {
    it('accepts a subset of the hinted bits', () => {
      expect(check('autowrap_trim_flags', '192')).toBeNull();
    });

    it('rejects a bit outside BREAK_TRIM_MASK, which the setter drops silently', () => {
      // rich_text_label.cpp:7390 stores `p_flags & BREAK_TRIM_MASK`, so 3 lands as 0. Nothing
      // downstream reports the loss, which is why this is the error tier.
      const error = check('autowrap_trim_flags', '3');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('Godot stores 0');
    });

    it('warns on BREAK_TRIM_INDENT, which the setter keeps but the hint omits', () => {
      expectWarning(check('autowrap_trim_flags', '32'), 'sets BREAK_TRIM_INDENT (32), which the engine keeps but the inspector\'s flag list does not offer (it lists only BREAK_TRIM_START_EDGE_SPACES (64) | BREAK_TRIM_END_EDGE_SPACES (128))');
    });

    it('rejects a negative value', () => {
      expectError(check('autowrap_trim_flags', '-1'), 'accepts only the bits BREAK_TRIM_INDENT (32) | BREAK_TRIM_START_EDGE_SPACES (64) | BREAK_TRIM_END_EDGE_SPACES (128); -1 sets bits outside the mask, which Godot drops on assignment (Godot stores 224)');
    });

    it('rejects a non-numeric value', () => {
      expect(check('autowrap_trim_flags', 'not-a-number')?.code).toBe(
        'INVALID_AUTOWRAP_TRIM_FLAGS_FORMAT'
      );
    });
  });

  describe('tab_size (integer 0-24, hinted)', () => {
    // rich_text_label.cpp:7763: PROPERTY_HINT_RANGE "0,24,1", no or_greater/or_less.
    it('accepts 0 (the floor)', () => {
      expect(check('tab_size', '0')).toBeNull();
    });

    it('accepts 24 (the ceiling)', () => {
      expect(check('tab_size', '24')).toBeNull();
    });

    it('warns past the ceiling (25): set_tab_size assigns straight through with no clamp', () => {
      expectWarning(check('tab_size', '25'), 'must be between 0 and 24');
    });

    it('warns below the floor (-1)', () => {
      expectWarning(check('tab_size', '-1'), 'must be between 0 and 24');
    });
  });

  describe('horizontal_alignment (enum 0-3, enforced)', () => {
    // set_horizontal_alignment (rich_text_label.cpp:7241-7255) opens with
    // `ERR_FAIL_INDEX((int)p_alignment, 4)` (line 7242): the setter refuses.
    it('accepts 0 (LEFT, the documented default)', () => {
      expect(check('horizontal_alignment', '0')).toBeNull();
    });

    it('accepts 3 (FILL)', () => {
      expect(check('horizontal_alignment', '3')).toBeNull();
    });

    it('errors past the enum (4): ERR_FAIL_INDEX refuses the write', () => {
      expectError(check('horizontal_alignment', '4'), 'must be 0-3');
    });

    it('errors on a negative value', () => {
      expectError(check('horizontal_alignment', '-1'), 'must be 0-3');
    });
  });

  describe('vertical_alignment (enum 0-3, enforced)', () => {
    // set_vertical_alignment (rich_text_label.cpp:7261-7270) opens with
    // `ERR_FAIL_INDEX((int)p_alignment, 4)` (line 7262).
    it('accepts 0 (TOP, the documented default)', () => {
      expect(check('vertical_alignment', '0')).toBeNull();
    });

    it('accepts 3 (FILL)', () => {
      expect(check('vertical_alignment', '3')).toBeNull();
    });

    it('errors past the enum (4)', () => {
      expectError(check('vertical_alignment', '4'), 'must be 0-3');
    });
  });

  describe('justification_flags (bitfield, format-only)', () => {
    // set_justification_flags (rich_text_label.cpp:7276-7289) bare-assigns
    // with no masking and no ERR_FAIL, and PROPERTY_HINT_FLAGS grounds no
    // bound (ADR-0032), so every integer combination is engine-legal.
    it('accepts a combination the hint names (3 = Kashida | Word Justification)', () => {
      expect(check('justification_flags', '3')).toBeNull();
    });

    it('warns on a bit the hint does not offer, which the engine still keeps', () => {
      // servers/text/text_server.h:78-88 declares JUSTIFICATION_CONSTRAIN_ELLIPSIS
      // = 16 and JUSTIFICATION_TRIM_EDGE_SPACES = 4, which the hint omits. The
      // setter keeps them, so they are unreachable from the inspector, not
      // refused: the hint's warning tier.
      expectWarning(check('justification_flags', '16'), 'sets a bit the inspector\'s flag list does not offer; it lists only JUSTIFICATION_KASHIDA (1) | JUSTIFICATION_WORD_BOUND (2) | JUSTIFICATION_AFTER_LAST_TAB (8) | JUSTIFICATION_SKIP_LAST_LINE (32) | JUSTIFICATION_SKIP_LAST_LINE_WITH_VISIBLE_CHARS (64) | JUSTIFICATION_DO_NOT_SKIP_SINGLE_LINE (128). Godot keeps the value, so this loads and runs, but the value is unreachable from the editor');
      expectWarning(check('justification_flags', '4'), 'sets a bit the inspector\'s flag list does not offer; it lists only JUSTIFICATION_KASHIDA (1) | JUSTIFICATION_WORD_BOUND (2) | JUSTIFICATION_AFTER_LAST_TAB (8) | JUSTIFICATION_SKIP_LAST_LINE (32) | JUSTIFICATION_SKIP_LAST_LINE_WITH_VISIBLE_CHARS (64) | JUSTIFICATION_DO_NOT_SKIP_SINGLE_LINE (128). Godot keeps the value, so this loads and runs, but the value is unreachable from the editor');
    });

    it('warns on a negative value for the same reason, since no clamp rejects it', () => {
      expectWarning(check('justification_flags', '-1'), 'sets a bit the inspector\'s flag list does not offer; it lists only JUSTIFICATION_KASHIDA (1) | JUSTIFICATION_WORD_BOUND (2) | JUSTIFICATION_AFTER_LAST_TAB (8) | JUSTIFICATION_SKIP_LAST_LINE (32) | JUSTIFICATION_SKIP_LAST_LINE_WITH_VISIBLE_CHARS (64) | JUSTIFICATION_DO_NOT_SKIP_SINGLE_LINE (128). Godot keeps the value, so this loads and runs, but the value is unreachable from the editor');
    });

    it('accepts any subset of the six bits the hint does offer', () => {
      for (const value of ['0', '1', '2', '3', '8', '32', '64', '128', '235']) {
        expect(check('justification_flags', value), value).toBeNull();
      }
    });
  });

  describe('tab_stops (PackedFloat32Array)', () => {
    it('accepts the empty-array default', () => {
      expect(check('tab_stops', 'PackedFloat32Array()')).toBeNull();
    });

    it('accepts a populated array', () => {
      expect(check('tab_stops', 'PackedFloat32Array(10, 20, 30)')).toBeNull();
    });

    it('accepts the non-finite spellings rtos_fix writes into a packed array', () => {
      for (const spelling of ['inf', '-inf', 'inf_neg', 'nan']) {
        expect(check('tab_stops', `PackedFloat32Array(${spelling}, 20)`)).toBeNull();
      }
    });

    it('rejects the JavaScript-only spellings Godot\'s tokenizer cannot read', () => {
      for (const spelling of ['0x10', 'Infinity', '+3']) {
        expect(check('tab_stops', `PackedFloat32Array(${spelling}, 20)`)).not.toBeNull();
      }
    });

    it('accepts the bare array spelling the slot converts', () => {
      // Measured on 4.6.3: `tab_stops = [10, 20, 30]` stores
      // PackedFloat32Array([10.0, 20.0, 30.0]). `can_convert_strict` lists
      // ARRAY as a valid source for every PACKED_* type (variant.cpp:467-473).
      expect(check('tab_stops', '[10, 20, 30]')).toBeNull();
    });

    it('rejects a value that is no array at all', () => {
      expect(check('tab_stops', 'Vector2(1, 2)')).not.toBeNull();
    });

    it('rejects a non-numeric element', () => {
      expect(check('tab_stops', 'PackedFloat32Array(10, foo, 30)')).not.toBeNull();
    });
  });

  describe('custom_effects (Array literal)', () => {
    it('accepts the empty-array default', () => {
      expect(check('custom_effects', '[]')).toBeNull();
    });

    it('accepts a typed Array[RichTextEffect] literal, the shape set_effects actually serialises for a populated list', () => {
      expect(check('custom_effects', 'Array[RichTextEffect]([SubResource("RichTextEffect_1")])')).toBeNull();
    });

    it('rejects a value not wrapped in brackets', () => {
      expect(check('custom_effects', 'SubResource("RichTextEffect_1")')).not.toBeNull();
    });
  });

  describe('progress_bar_delay (integer, no bound)', () => {
    // rich_text_label.cpp:7779: PROPERTY_HINT_NONE, and "suffix:ms" is a unit,
    // not a range. set_progress_bar_delay (rich_text_label.cpp:3793-3795)
    // stores any int unaltered.
    it('accepts the documented default (1000)', () => {
      expect(check('progress_bar_delay', '1000')).toBeNull();
    });

    it('accepts -1, which disables the progress bar entirely per the class doc', () => {
      expect(check('progress_bar_delay', '-1')).toBeNull();
    });

    it('accepts 0', () => {
      expect(check('progress_bar_delay', '0')).toBeNull();
    });
  });

  describe('visible_characters (integer -1-128000, both ends hinted)', () => {
    // rich_text_label.cpp:7788: PROPERTY_HINT_RANGE "-1,128000,1", closed at
    // both ends; the setter assigns straight through, so both ends warn.
    it('accepts -1, the documented "all characters" sentinel and the documented default', () => {
      expect(check('visible_characters', '-1')).toBeNull();
    });

    it('accepts the hint ceiling exactly (128000, rich_text_label.cpp:7788)', () => {
      expect(check('visible_characters', '128000')).toBeNull();
    });

    it('warns one past the ceiling (128001): the hint closes that end with no or_greater', () => {
      expectWarning(check('visible_characters', '128001'), 'must be between -1 and 128000');
    });

    it('warns below the floor (-2): set_visible_characters assigns straight through with no clamp', () => {
      expectWarning(check('visible_characters', '-2'), 'must be between -1 and 128000');
    });
  });

  describe('visible_characters_behavior (enum 0-4, hinted)', () => {
    it('accepts 0 (VC_CHARS_BEFORE_SHAPING, the documented default)', () => {
      expect(check('visible_characters_behavior', '0')).toBeNull();
    });

    it('accepts 4 (VC_GLYPHS_RTL)', () => {
      expect(check('visible_characters_behavior', '4')).toBeNull();
    });

    it('warns past the enum (5)', () => {
      expectWarning(check('visible_characters_behavior', '5'), 'must be 0-4');
    });
  });

  describe('visible_ratio (float 0-1, hinted)', () => {
    // set_visible_ratio (rich_text_label.cpp:7401-7459) clamps >= 1.0 to 1.0
    // (line 7406-7408) and < 0.0 to 0.0 (line 7409-7411), but behind a guard
    // that a preceding visible_characters skips, so out of range warns.
    it('accepts 0 (the floor)', () => {
      expect(check('visible_ratio', '0')).toBeNull();
    });

    it('accepts 1 (the documented default and ceiling)', () => {
      expect(check('visible_ratio', '1')).toBeNull();
    });

    it('warns above 1: the clamp is guarded, so a preceding visible_characters leaves 3.0 stored', () => {
      expectWarning(check('visible_ratio', '1.5'), 'must be between 0 and 1');
    });

    it('warns below 0: the same guard, and the hint is what bounds the inspector', () => {
      expectWarning(check('visible_ratio', '-0.5'), 'must be between 0 and 1');
    });
  });

  describe('text_direction (enum -1-3, enforced)', () => {
    // set_text_direction (rich_text_label.cpp:7220-7235) opens with
    // `ERR_FAIL_COND((int)p_text_direction < -1 || > 3)` (line 7221).
    it('accepts 0 (TEXT_DIRECTION_AUTO, the documented default)', () => {
      expect(check('text_direction', '0')).toBeNull();
    });

    it('accepts 3 (TEXT_DIRECTION_INHERITED)', () => {
      expect(check('text_direction', '3')).toBeNull();
    });

    it('warns on -1: the setter loads it, the hint does not offer it', () => {
      expectWarning(check('text_direction', '-1'), 'must be 0-3');
    });

    it('errors past the enum (4)', () => {
      expectError(check('text_direction', '4'), 'must be 0-3');
    });

    it('errors below -1 (-2)', () => {
      expectError(check('text_direction', '-2'), 'must be at least -1');
    });
  });

  describe('language (quoted string)', () => {
    it('accepts a locale id', () => {
      expect(check('language', '"en_GB"')).toBeNull();
    });

    it('accepts an empty string, which means the project default', () => {
      expect(check('language', '""')).toBeNull();
    });

    it('rejects an unquoted value', () => {
      expect(check('language', 'en_GB')).not.toBeNull();
    });
  });

  describe('structured_text_bidi_override (enum 0-6, hinted)', () => {
    it('accepts 0 (STRUCTURED_TEXT_DEFAULT, the documented default)', () => {
      expect(check('structured_text_bidi_override', '0')).toBeNull();
    });

    it('accepts 6 (STRUCTURED_TEXT_CUSTOM)', () => {
      expect(check('structured_text_bidi_override', '6')).toBeNull();
    });

    it('warns past the enum (7)', () => {
      expectWarning(check('structured_text_bidi_override', '7'), 'must be 0-6');
    });

    it('warns on a negative value', () => {
      expectWarning(check('structured_text_bidi_override', '-1'), 'must be 0-6');
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
  });

  it('the unit fixture carries only values Godot accepts', () => {
    expectFixtureClean('unit-rich-text-label.tscn');
  });
});
