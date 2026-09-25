/**
 * Label strict validators, asserted through `validatorRegistry` so a failure
 * points at the validator, not at scene parsing. It skips `Linter`, whose
 * `linter/index.ts` imports every slice, and imports only `./linterParser` and
 * the fixture-driven `StrictTscnParser` check.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import { checkerFor, expectError, expectWarning } from '../../../../linter/testing/validatorCheck';
import './linterParser';

/** Label's own members, doc/classes/Label.xml minus the two `overrides="Control"` entries. */
const OWN_KEYS = [
  'text',
  'label_settings',
  'horizontal_alignment',
  'vertical_alignment',
  'autowrap_mode',
  'autowrap_trim_flags',
  'justification_flags',
  'paragraph_separator',
  'clip_text',
  'text_overrun_behavior',
  'ellipsis_char',
  'uppercase',
  'tab_stops',
  'lines_skipped',
  'max_lines_visible',
  'visible_characters',
  'visible_characters_behavior',
  'visible_ratio',
  'text_direction',
  'language',
  'structured_text_bidi_override',
  'structured_text_bidi_override_options',
];

/** `Label.<property>`'s registered validator, invoked at line 1. */
const check = checkerFor('Label');

describe('Label strict validators', () => {
  it('declares exactly its own 22 members', () => {
    expect(validatorRegistry.getOwnKeys('Label').slice().sort()).toEqual([...OWN_KEYS].sort());
  });

  it('rejects a malformed value on every property it validates', () => {
    const accepted = validatorRegistry
      .getOwnKeys('Label')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('text', () => {
    it('accepts a quoted string', () => {
      expect(check('text', '"Hello"')).toBeNull();
    });

    it('accepts an empty string', () => {
      expect(check('text', '""')).toBeNull();
    });

    it('rejects an unquoted string', () => {
      expect(check('text', 'Hello')).not.toBeNull();
    });
  });

  describe('label_settings', () => {
    it('accepts a SubResource reference', () => {
      expect(check('label_settings', 'SubResource("LabelSettings_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('label_settings', 'ExtResource("1_settings")')).toBeNull();
    });

    it('rejects a bare path', () => {
      expect(check('label_settings', '"res://settings.tres"')).not.toBeNull();
    });
  });

  describe('horizontal_alignment', () => {
    it('accepts every value the hint names (0-3)', () => {
      expect(check('horizontal_alignment', '0')).toBeNull();
      expect(check('horizontal_alignment', '1')).toBeNull();
      expect(check('horizontal_alignment', '2')).toBeNull();
      expect(check('horizontal_alignment', '3')).toBeNull();
    });

    it('rejects 4, past the ERR_FAIL_INDEX(idx, 4) the setter enforces (label.cpp:1065)', () => {
      expectError(check('horizontal_alignment', '4'), 'must be 0-3');
    });

    it('rejects a negative value', () => {
      expect(check('horizontal_alignment', '-1')).not.toBeNull();
    });
  });

  describe('vertical_alignment', () => {
    it('accepts every value the hint names (0-3)', () => {
      expect(check('vertical_alignment', '0')).toBeNull();
      expect(check('vertical_alignment', '3')).toBeNull();
    });

    it('rejects 4, past the ERR_FAIL_INDEX(idx, 4) the setter enforces (label.cpp:1085)', () => {
      expectError(check('vertical_alignment', '4'), 'must be 0-3');
    });
  });

  describe('autowrap_mode', () => {
    it('accepts every value the hint names (0-3)', () => {
      expect(check('autowrap_mode', '0')).toBeNull();
      expect(check('autowrap_mode', '3')).toBeNull();
    });

    it('warns (not errors) on 4, one past the enum — set_autowrap_mode (label.cpp:37-52) bare-assigns', () => {
      expectWarning(check('autowrap_mode', '4'), 'must be 0-3');
    });
  });

  describe('autowrap_trim_flags', () => {
    it('accepts a subset of the hinted bits', () => {
      expect(check('autowrap_trim_flags', '192')).toBeNull();
    });

    it('rejects a bit outside BREAK_TRIM_MASK, which the setter drops silently', () => {
      // label.cpp:63 stores `p_flags & BREAK_TRIM_MASK`, so 3 lands as 0. Nothing
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

  describe('justification_flags', () => {
    it('warns on the full 8-bit combination, which sets two unoffered bits', () => {
      // set_justification_flags (label.cpp:79-93) bare-assigns with no mask, so
      // 255 loads unaltered. But label.cpp:1437 offers only {1,2,8,32,64,128},
      // so bits 4 and 16 are unreachable from the inspector: warning, not error.
      expectWarning(check('justification_flags', '255'), 'sets a bit the inspector\'s flag list does not offer; it lists only JUSTIFICATION_KASHIDA (1) | JUSTIFICATION_WORD_BOUND (2) | JUSTIFICATION_AFTER_LAST_TAB (8) | JUSTIFICATION_SKIP_LAST_LINE (32) | JUSTIFICATION_SKIP_LAST_LINE_WITH_VISIBLE_CHARS (64) | JUSTIFICATION_DO_NOT_SKIP_SINGLE_LINE (128). Godot keeps the value, so this loads and runs, but the value is unreachable from the editor');
    });

    it('accepts 235, the OR of every bit the hint does offer', () => {
      expect(check('justification_flags', '235')).toBeNull();
    });

    it('accepts 0 (JUSTIFICATION_NONE)', () => {
      expect(check('justification_flags', '0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('justification_flags', 'not-a-number')).not.toBeNull();
    });
  });

  describe('paragraph_separator', () => {
    it('accepts a quoted string', () => {
      expect(check('paragraph_separator', '"\\n"')).toBeNull();
    });

    it('rejects an unquoted value', () => {
      expect(check('paragraph_separator', 'nl')).not.toBeNull();
    });
  });

  describe('clip_text', () => {
    it('accepts true', () => {
      expect(check('clip_text', 'true')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('clip_text', 'yes')).not.toBeNull();
    });
  });

  describe('text_overrun_behavior', () => {
    it('accepts every value the hint names (0-6)', () => {
      expect(check('text_overrun_behavior', '0')).toBeNull();
      expect(check('text_overrun_behavior', '6')).toBeNull();
    });

    it('warns (not errors) on 7, one past the enum — set_text_overrun_behavior (label.cpp:1239-1252) bare-assigns', () => {
      expectWarning(check('text_overrun_behavior', '7'), 'must be 0-6');
    });
  });

  describe('ellipsis_char', () => {
    it('accepts a single-character literal', () => {
      expect(check('ellipsis_char', '"…"')).toBeNull();
    });

    it('accepts an empty literal', () => {
      expect(check('ellipsis_char', '""')).toBeNull();
    });

    it('errors on a literal longer than one character — set_ellipsis_char (label.cpp:1258-1275) truncates it (label.cpp:1260-1262)', () => {
      expectError(check('ellipsis_char', '"..."'), 'must be at most one character, got 3 characters: "..."');
    });

    it('rejects an unquoted value as a format error', () => {
      expect(check('ellipsis_char', '.')).not.toBeNull();
    });
  });

  describe('uppercase', () => {
    it('accepts true and false', () => {
      expect(check('uppercase', 'true')).toBeNull();
      expect(check('uppercase', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('uppercase', '1')).not.toBeNull();
    });
  });

  describe('tab_stops', () => {
    it('accepts an empty array', () => {
      expect(check('tab_stops', 'PackedFloat32Array()')).toBeNull();
    });

    it('accepts a populated array, including negative values', () => {
      expect(check('tab_stops', 'PackedFloat32Array(10, 20, -5.5)')).toBeNull();
    });

    it('accepts the non-finite spellings rtos_fix writes into a packed array', () => {
      // variant_parser.cpp:2504 emits `inf`/`-inf`/`nan` for a float element, so
      // these are files Godot produced and reloads.
      for (const spelling of ['inf', '-inf', 'inf_neg', 'nan']) {
        expect(check('tab_stops', `PackedFloat32Array(${spelling}, 20)`)).toBeNull();
      }
    });

    it('rejects the JavaScript-only spellings Godot\'s tokenizer cannot read', () => {
      // `READING_INT` stops at the `x` (there is no hex branch), and `Infinity`
      // is not one of the four identifiers `stor_fix` resolves.
      for (const spelling of ['0x10', 'Infinity', '+3']) {
        expect(check('tab_stops', `PackedFloat32Array(${spelling}, 20)`)).not.toBeNull();
      }
    });

    it('rejects a value missing the wrapper', () => {
      expect(check('tab_stops', '10, 20, 30')).not.toBeNull();
    });

    it('rejects a non-numeric element', () => {
      expect(check('tab_stops', 'PackedFloat32Array(10, oops, 30)')).not.toBeNull();
    });
  });

  describe('lines_skipped', () => {
    it('accepts 0 and values within the hint', () => {
      expect(check('lines_skipped', '0')).toBeNull();
      expect(check('lines_skipped', '999')).toBeNull();
    });

    it('warns (not errors) above the 999 hint ceiling — only the hint states it', () => {
      expectWarning(check('lines_skipped', '1500'), 'must be between 0 and 999');
    });

    it('errors below 0 — set_lines_skipped refuses a negative outright', () => {
      expectError(check('lines_skipped', '-1'), 'must be between 0 and 999');
    });
  });

  describe('max_lines_visible', () => {
    it('accepts -1 (no limit) and values within the hint', () => {
      expect(check('max_lines_visible', '-1')).toBeNull();
      expect(check('max_lines_visible', '999')).toBeNull();
    });

    it('warns (not errors) below -1 — set_max_lines_visible (label.cpp:1361-1369) has no ERR_FAIL or clamp at all', () => {
      expectWarning(check('max_lines_visible', '-5'), 'must be between -1 and 999');
    });

    it('warns (not errors) above the 999 hint ceiling', () => {
      expectWarning(check('max_lines_visible', '1500'), 'must be between -1 and 999');
    });
  });

  describe('visible_characters', () => {
    it('accepts -1 (show all, the documented sentinel)', () => {
      expect(check('visible_characters', '-1')).toBeNull();
    });

    it('accepts 0 and ordinary positive counts', () => {
      expect(check('visible_characters', '0')).toBeNull();
      expect(check('visible_characters', '50')).toBeNull();
    });

    it('accepts the hint ceiling exactly (128000, label.cpp:1450)', () => {
      expect(check('visible_characters', '128000')).toBeNull();
    });

    it('warns one past the ceiling (128001) — the hint closes that end with no or_greater', () => {
      expectWarning(check('visible_characters', '128001'), 'must be between -1 and 128000');
    });

    it('warns (not errors) below -1 — set_visible_characters (label.cpp:1285-1299) has no ERR_FAIL or clamp at all', () => {
      expectWarning(check('visible_characters', '-2'), 'must be between -1 and 128000');
    });
  });

  describe('visible_characters_behavior', () => {
    it('accepts every value the hint names (0-4)', () => {
      expect(check('visible_characters_behavior', '0')).toBeNull();
      expect(check('visible_characters_behavior', '4')).toBeNull();
    });

    it('warns (not errors) on 5, one past the enum', () => {
      expectWarning(check('visible_characters_behavior', '5'), 'must be 0-4');
    });
  });

  describe('visible_ratio', () => {
    it('accepts 0, 1 and values between', () => {
      expect(check('visible_ratio', '0')).toBeNull();
      expect(check('visible_ratio', '1')).toBeNull();
      expect(check('visible_ratio', '0.5')).toBeNull();
    });

    it('warns above 1: the clamp is guarded, so a preceding visible_characters leaves 3.0 stored', () => {
      expectWarning(check('visible_ratio', '1.5'), 'must be between 0 and 1');
    });

    it('warns below 0: the same guard, and the hint is what bounds the inspector', () => {
      expectWarning(check('visible_ratio', '-0.1'), 'must be between 0 and 1');
    });
  });

  describe('text_direction', () => {
    it('accepts every value the hint names (0-3)', () => {
      expect(check('text_direction', '0')).toBeNull();
      expect(check('text_direction', '3')).toBeNull();
    });

    it('warns on -1: the setter loads it, the hint does not offer it', () => {
      expectWarning(check('text_direction', '-1'), 'must be 0-3');
    });

    it('errors on 4, past the ERR_FAIL_COND the setter enforces (label.cpp:1140)', () => {
      expectError(check('text_direction', '4'), 'must be 0-3');
    });

    it('errors on -2, past the ERR_FAIL_COND on the other side', () => {
      expectError(check('text_direction', '-2'), 'must be at least -1');
    });
  });

  describe('language', () => {
    it('accepts a locale id', () => {
      expect(check('language', '"en_GB"')).toBeNull();
    });

    it('accepts an empty string (project default)', () => {
      expect(check('language', '""')).toBeNull();
    });

    it('rejects an unquoted value', () => {
      expect(check('language', 'en_GB')).not.toBeNull();
    });
  });

  describe('structured_text_bidi_override', () => {
    it('accepts every value the hint names (0-6)', () => {
      expect(check('structured_text_bidi_override', '0')).toBeNull();
      expect(check('structured_text_bidi_override', '6')).toBeNull();
    });

    it('warns (not errors) on 7, one past the enum', () => {
      expectWarning(check('structured_text_bidi_override', '7'), 'must be 0-6');
    });
  });

  describe('structured_text_bidi_override_options', () => {
    it('accepts an empty array literal', () => {
      expect(check('structured_text_bidi_override_options', '[]')).toBeNull();
    });

    it('accepts a populated array literal', () => {
      expect(check('structured_text_bidi_override_options', '[1, 2]')).toBeNull();
    });

    it('rejects a non-array value', () => {
      expect(check('structured_text_bidi_override_options', 'not-an-array')).not.toBeNull();
    });
  });

  it('never re-declares anchor_right or modulate, which Control/CanvasItem own', () => {
    expect(validatorRegistry.getOwnKeys('Label')).not.toContain('anchor_right');
    expect(validatorRegistry.getOwnKeys('Label')).not.toContain('modulate');
  });

  it('resolves inherited keys through the base-walk', () => {
    expect(validatorRegistry.findValidator('Label', 'anchor_right')).not.toBeNull();
    expect(validatorRegistry.findValidator('Label', 'modulate')).not.toBeNull();
  });

  it('accepts every value its own fixture carries', () => {
    expectFixtureClean('unit-label-2d.tscn');
  });
});
