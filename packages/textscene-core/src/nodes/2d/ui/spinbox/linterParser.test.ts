/**
 * SpinBox strict validators: format and range checks, asserted through `validatorRegistry` rather
 * than a linted `.tscn`, so a failure points at the validator.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('SpinBox', property);
  expect(validator, `no validator registered for SpinBox.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('SpinBox strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('SpinBox')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases follow.
    const accepted = validatorRegistry
      .getOwnKeys('SpinBox')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  // spin_box.cpp:673: ADD_PROPERTY(PropertyInfo(Variant::INT, "alignment",
  // PROPERTY_HINT_ENUM, "Left,Center,Right,Fill"), "set_horizontal_alignment", …).
  // LineEdit::set_horizontal_alignment (line_edit.cpp:1072) is
  // ERR_FAIL_INDEX((int)p_alignment, 4): enforced, not merely hinted.
  describe('alignment', () => {
    it('accepts a typical value', () => {
      expect(check('alignment', '2')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('alignment', 'right')).not.toBeNull();
    });

    it('accepts the lowest valid index', () => {
      expect(check('alignment', '0')).toBeNull();
    });

    it('accepts the highest valid index (FILL)', () => {
      expect(check('alignment', '3')).toBeNull();
    });

    it('rejects an out-of-range index as an error, since LineEdit::set_horizontal_alignment ERR_FAIL_INDEXs it', () => {
      const error = check('alignment', '4');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });
  });

  // spin_box.cpp:674: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "editable"), …).
  describe('editable', () => {
    it('accepts true', () => {
      expect(check('editable', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('editable', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('editable', '1')).not.toBeNull();
    });
  });

  // spin_box.cpp:675: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "update_on_text_changed"), …).
  describe('update_on_text_changed', () => {
    it('accepts true', () => {
      expect(check('update_on_text_changed', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('update_on_text_changed', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('update_on_text_changed', 'always')).not.toBeNull();
    });
  });

  // spin_box.cpp:676: ADD_PROPERTY(PropertyInfo(Variant::STRING, "prefix"), …).
  describe('prefix', () => {
    it('accepts a quoted string', () => {
      expect(check('prefix', '"$"')).toBeNull();
    });

    it('accepts an empty quoted string, SpinBox.xml\'s own default for prefix', () => {
      expect(check('prefix', '""')).toBeNull();
    });

    it('rejects an unquoted value', () => {
      expect(check('prefix', '$')).not.toBeNull();
    });
  });

  // spin_box.cpp:677: ADD_PROPERTY(PropertyInfo(Variant::STRING, "suffix"), …).
  describe('suffix', () => {
    it('accepts a quoted string', () => {
      expect(check('suffix', '"kg"')).toBeNull();
    });

    it('accepts an empty quoted string, SpinBox.xml\'s own default for suffix', () => {
      expect(check('suffix', '""')).toBeNull();
    });

    it('rejects an unquoted value', () => {
      expect(check('suffix', 'kg')).not.toBeNull();
    });
  });

  // spin_box.cpp:678: ADD_PROPERTY(PropertyInfo(Variant::FLOAT,
  // "custom_arrow_step", PROPERTY_HINT_RANGE, "0,10000,0.0001,or_greater"), …).
  // set_custom_arrow_step (:615-617) only assigns, so the bound warns, and `or_greater` leaves
  // the max end open.
  describe('custom_arrow_step', () => {
    it('accepts a typical value', () => {
      expect(check('custom_arrow_step', '0.5')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('custom_arrow_step', 'chunky')).not.toBeNull();
    });

    it('accepts 0, the constructor default meaning "no custom step"', () => {
      expect(check('custom_arrow_step', '0')).toBeNull();
    });

    it("accepts a value far above 10000, since or_greater opens the hint's max end", () => {
      expect(check('custom_arrow_step', '50000')).toBeNull();
    });

    it('warns rather than errors below the hinted floor of 0', () => {
      const error = check('custom_arrow_step', '-1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });
  });

  // spin_box.cpp:679: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "custom_arrow_round"), …).
  describe('custom_arrow_round', () => {
    it('accepts true', () => {
      expect(check('custom_arrow_round', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('custom_arrow_round', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('custom_arrow_round', 'yes')).not.toBeNull();
    });
  });

  // spin_box.cpp:680: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "select_all_on_focus"), …).
  describe('select_all_on_focus', () => {
    it('accepts true', () => {
      expect(check('select_all_on_focus', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('select_all_on_focus', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('select_all_on_focus', 'maybe')).not.toBeNull();
    });
  });

  it('does not re-register size_flags_vertical, since it carries overrides="Control" in SpinBox.xml, so Control already owns it', () => {
    expect(validatorRegistry.getOwnKeys('SpinBox')).not.toContain('size_flags_vertical');
  });

  it('does not re-register step, since it carries overrides="Range" (default="1.0") in SpinBox.xml, so Range already owns it', () => {
    expect(validatorRegistry.getOwnKeys('SpinBox')).not.toContain('step');
  });

  it('resolves step from Range through the base-walk without SpinBox re-declaring it', () => {
    expect(check('step', '0.25')).toBeNull();
    expect(check('step', 'chunky')).not.toBeNull();
  });

  it('does not remove exp_edit: SpinBox::_validate_property only hides it from the inspector, and Range::set_exp_ratio still accepts the write', () => {
    expect(validatorRegistry.getOwnKeys('SpinBox')).not.toContain('exp_edit');
    expect(check('exp_edit', 'true')).toBeNull();
    expect(check('exp_edit', 'false')).toBeNull();
  });

  it('resolves min_value from Range through the base-walk', () => {
    expect(check('min_value', '-10')).toBeNull();
  });

  it('resolves anchor_right from Control through the base-walk', () => {
    expect(check('anchor_right', '1.0')).toBeNull();
  });

  it('resolves modulate from CanvasItem through the base-walk', () => {
    expect(check('modulate', 'Color(1, 1, 1, 1)')).toBeNull();
  });
});
