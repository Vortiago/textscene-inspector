/**
 * Button strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing. There is no genuine cross-field rule for Button,
 * so there is no `linter.ts` / `linter.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('Button', property);
  expect(validator, `no validator registered for Button.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('Button strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('Button')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    const accepted = validatorRegistry
      .getOwnKeys('Button')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('text', () => {
    it('accepts a quoted string', () => {
      expect(check('text', '"Click Me"')).toBeNull();
    });

    it('accepts an empty string', () => {
      expect(check('text', '""')).toBeNull();
    });

    it('rejects an unquoted string', () => {
      expect(check('text', 'Click Me')).not.toBeNull();
    });
  });

  describe('icon', () => {
    it('accepts an ExtResource reference', () => {
      expect(check('icon', 'ExtResource("1_icon")')).toBeNull();
    });

    it('accepts a SubResource reference', () => {
      expect(check('icon', 'SubResource("ImageTexture_1")')).toBeNull();
    });

    it('rejects a bare path', () => {
      expect(check('icon', '"res://icon.png"')).not.toBeNull();
    });
  });

  describe('flat', () => {
    it('accepts true', () => {
      expect(check('flat', 'true')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('flat', '1')).not.toBeNull();
    });
  });

  describe('alignment', () => {
    // button.cpp:814 — PROPERTY_HINT_ENUM "Left,Center,Right" only labels 0-2.
    it('accepts 1 (CENTER), the value the corpus uses most', () => {
      expect(check('alignment', '1')).toBeNull();
    });

    it('accepts 2 (RIGHT), the last entry the hint names', () => {
      expect(check('alignment', '2')).toBeNull();
    });

    it('accepts HORIZONTAL_ALIGNMENT_FILL (3) — set_text_alignment (button.cpp:737-741) bare-assigns with no ERR_FAIL, so a value the hint does not offer still reaches the engine', () => {
      expect(check('alignment', '3')).toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('alignment', '-1')).not.toBeNull();
    });
  });

  describe('text_overrun_behavior', () => {
    it('accepts 3 (OVERRUN_TRIM_ELLIPSIS), which the corpus uses', () => {
      expect(check('text_overrun_behavior', '3')).toBeNull();
    });

    it('accepts 6, the last of the 7 entries the hint names', () => {
      expect(check('text_overrun_behavior', '6')).toBeNull();
    });

    it('rejects 7, one past the enum', () => {
      expect(check('text_overrun_behavior', '7')).not.toBeNull();
    });
  });

  describe('autowrap_mode', () => {
    it('accepts 3 (AUTOWRAP_WORD_SMART), the last entry', () => {
      expect(check('autowrap_mode', '3')).toBeNull();
    });

    it('accepts 0 (AUTOWRAP_OFF)', () => {
      expect(check('autowrap_mode', '0')).toBeNull();
    });

    it('rejects 4, one past the enum', () => {
      expect(check('autowrap_mode', '4')).not.toBeNull();
    });
  });

  describe('autowrap_trim_flags', () => {
    it('accepts a subset of the hinted bits', () => {
      expect(check('autowrap_trim_flags', '192')).toBeNull();
    });

    it('rejects a bit outside BREAK_TRIM_MASK, which the setter drops silently', () => {
      // button.cpp:625 stores `p_flags & BREAK_TRIM_MASK`, so 3 lands as 0. Nothing
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

  describe('clip_text', () => {
    it('accepts true', () => {
      expect(check('clip_text', 'true')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('clip_text', 'yes')).not.toBeNull();
    });
  });

  describe('icon_alignment', () => {
    it('accepts 2 (RIGHT)', () => {
      expect(check('icon_alignment', '2')).toBeNull();
    });

    it('accepts 3 (FILL) — set_icon_alignment (button.cpp:749-756) bare-assigns with no ERR_FAIL, even though the hint does not name it', () => {
      expect(check('icon_alignment', '3')).toBeNull();
    });
  });

  describe('vertical_icon_alignment', () => {
    it('accepts 1 (CENTER), the documented default', () => {
      expect(check('vertical_icon_alignment', '1')).toBeNull();
    });

    it('accepts 2 (BOTTOM), the last entry', () => {
      expect(check('vertical_icon_alignment', '2')).toBeNull();
    });

    it('accepts 3 (FILL) — set_vertical_icon_alignment (button.cpp:759-770) bare-assigns with no ERR_FAIL, even though the hint does not name it', () => {
      expect(check('vertical_icon_alignment', '3')).toBeNull();
    });
  });

  describe('expand_icon', () => {
    it('accepts false', () => {
      expect(check('expand_icon', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      expect(check('expand_icon', 'off')).not.toBeNull();
    });
  });

  describe('text_direction', () => {
    it('accepts 0 (AUTO), 1 (LTR) and 2 (RTL), the values the corpus carries', () => {
      expect(check('text_direction', '0')).toBeNull();
      expect(check('text_direction', '1')).toBeNull();
      expect(check('text_direction', '2')).toBeNull();
    });

    it('accepts 3 (INHERITED), the last entry the hint names', () => {
      expect(check('text_direction', '3')).toBeNull();
    });

    it('accepts -1, a legacy value with no named constant that the ERR_FAIL_COND still allows', () => {
      // button.cpp:637 fails outside -1..3, so -1 itself is engine-legal.
      expect(check('text_direction', '-1')).toBeNull();
    });

    it('rejects 4, past the ERR_FAIL_COND the setter enforces', () => {
      // button.cpp:637 fails outside -1..3.
      expect(check('text_direction', '4')).not.toBeNull();
    });

    it('rejects -2, past the ERR_FAIL_COND on the other side', () => {
      expect(check('text_direction', '-2')).not.toBeNull();
    });
  });

  describe('language', () => {
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

  it('never re-declares disabled, which BaseButton owns even though parser.ts reads it', () => {
    expect(validatorRegistry.getOwnKeys('Button')).not.toContain('disabled');
  });

  it('resolves inherited keys through the base-walk', () => {
    // BaseButton, Control and CanvasItem keys must reach a Button without being
    // re-declared here.
    expect(validatorRegistry.findValidator('Button', 'disabled')).not.toBeNull();
    expect(validatorRegistry.findValidator('Button', 'toggle_mode')).not.toBeNull();
    expect(validatorRegistry.findValidator('Button', 'anchor_right')).not.toBeNull();
    expect(validatorRegistry.findValidator('Button', 'modulate')).not.toBeNull();
  });
});
