/**
 * Label strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing. Deliberately does NOT go through `Linter`
 * (`linter/index.ts` imports every slice in the repo, several of which are
 * being edited concurrently), so this only imports `./linterParser` plus the
 * fixture-driven `StrictTscnParser` check.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
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

/** The pre-4.0 spellings `Label::_set` still accepts (label.cpp:1002, :1005). */
const DEPRECATED_KEYS = ['align', 'valign'];

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('Label', property);
  expect(validator, `no validator registered for Label.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('Label strict validators', () => {
  it('declares exactly its own 22 members plus the two pre-4.0 spellings', () => {
    expect(validatorRegistry.getOwnKeys('Label').slice().sort()).toEqual(
      [...OWN_KEYS, ...DEPRECATED_KEYS].sort()
    );
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
      const error = check('horizontal_alignment', '4');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
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
      const error = check('vertical_alignment', '4');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });
  });

  describe('autowrap_mode', () => {
    it('accepts every value the hint names (0-3)', () => {
      expect(check('autowrap_mode', '0')).toBeNull();
      expect(check('autowrap_mode', '3')).toBeNull();
    });

    it('warns (not errors) on 4, one past the enum — set_autowrap_mode (label.cpp:37-52) bare-assigns', () => {
      const error = check('autowrap_mode', '4');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
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
      expect(check('autowrap_trim_flags', '32')?.severity).toBe('warning');
    });

    it('rejects a negative value', () => {
      expect(check('autowrap_trim_flags', '-1')?.severity).toBe('error');
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
      // 255 LOADS unaltered. But label.cpp:1437 offers only {1,2,8,32,64,128},
      // so bits 4 and 16 are unreachable from the inspector: warning, not error.
      expect(check('justification_flags', '255')?.severity).toBe('warning');
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
      const error = check('text_overrun_behavior', '7');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
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
      const error = check('ellipsis_char', '"..."');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
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
      const error = check('lines_skipped', '1500');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('errors below 0 — set_lines_skipped refuses a negative outright', () => {
      const error = check('lines_skipped', '-1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });
  });

  describe('max_lines_visible', () => {
    it('accepts -1 (no limit) and values within the hint', () => {
      expect(check('max_lines_visible', '-1')).toBeNull();
      expect(check('max_lines_visible', '999')).toBeNull();
    });

    it('warns (not errors) below -1 — set_max_lines_visible (label.cpp:1361-1369) has no ERR_FAIL or clamp at all', () => {
      const error = check('max_lines_visible', '-5');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('warns (not errors) above the 999 hint ceiling', () => {
      const error = check('max_lines_visible', '1500');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
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
      const error = check('visible_characters', '128001');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('warns (not errors) below -1 — set_visible_characters (label.cpp:1285-1299) has no ERR_FAIL or clamp at all', () => {
      const error = check('visible_characters', '-2');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });
  });

  describe('visible_characters_behavior', () => {
    it('accepts every value the hint names (0-4)', () => {
      expect(check('visible_characters_behavior', '0')).toBeNull();
      expect(check('visible_characters_behavior', '4')).toBeNull();
    });

    it('warns (not errors) on 5, one past the enum', () => {
      const error = check('visible_characters_behavior', '5');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });
  });

  describe('visible_ratio', () => {
    it('accepts 0, 1 and values between', () => {
      expect(check('visible_ratio', '0')).toBeNull();
      expect(check('visible_ratio', '1')).toBeNull();
      expect(check('visible_ratio', '0.5')).toBeNull();
    });

    it('warns above 1: the clamp is guarded, so a preceding visible_characters leaves 3.0 stored', () => {
      const error = check('visible_ratio', '1.5');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('warns below 0: the same guard, and the hint is what bounds the inspector', () => {
      const error = check('visible_ratio', '-0.1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });
  });

  describe('text_direction', () => {
    it('accepts every value the hint names (0-3)', () => {
      expect(check('text_direction', '0')).toBeNull();
      expect(check('text_direction', '3')).toBeNull();
    });

    it('accepts -1, a legacy value with no named constant the ERR_FAIL_COND still allows', () => {
      expect(check('text_direction', '-1')).toBeNull();
    });

    it('errors on 4, past the ERR_FAIL_COND the setter enforces (label.cpp:1140)', () => {
      const error = check('text_direction', '4');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });

    it('errors on -2, past the ERR_FAIL_COND on the other side', () => {
      const error = check('text_direction', '-2');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
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
      const error = check('structured_text_bidi_override', '7');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
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

  describe('align, the pre-4.0 spelling of horizontal_alignment', () => {
    it('accepts the four HorizontalAlignment constants', () => {
      // label.cpp:1005 casts to int and calls set_horizontal_alignment, so the
      // same four values reach the same setter.
      for (const value of ['0', '1', '2', '3']) {
        expect(check('align', value)).toBeNull();
      }
    });

    it('errors past the enum, which ERR_FAIL_INDEX refuses', () => {
      // label.cpp:1065, `ERR_FAIL_INDEX((int)p_alignment, 4)`.
      const error = check('align', '5');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('error');
    });

    it('names the deprecated key, not the canonical one', () => {
      const error = check('align', '5');
      expect(error!.message).toContain("'align'");
      expect(error!.message).not.toContain('horizontal_alignment');
    });

    it('rejects a non-integer literal', () => {
      expect(check('align', '"left"')).not.toBeNull();
    });
  });

  describe('valign, the pre-4.0 spelling of vertical_alignment', () => {
    it('accepts the four VerticalAlignment constants', () => {
      // label.cpp:1002 casts to int and calls set_vertical_alignment.
      for (const value of ['0', '1', '2', '3']) {
        expect(check('valign', value)).toBeNull();
      }
    });

    it('errors past the enum, which ERR_FAIL_INDEX refuses', () => {
      // label.cpp:1085, `ERR_FAIL_INDEX((int)p_alignment, 4)`.
      const error = check('valign', '4');
      expect(error).not.toBeNull();
      expect(error!.severity).toBe('error');
      expect(error!.message).toContain("'valign'");
      expect(error!.message).not.toContain('vertical_alignment');
    });
  });
});
