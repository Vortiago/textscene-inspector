/**
 * Range strict validators: format checks, asserted through `validatorRegistry`
 * so a failure points at the validator, not at scene parsing. No bound is
 * hint-tier. `page` has a setter clamp, which is the error tier.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('Range', property);
  expect(validator, `no validator registered for Range.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('Range strict validators', () => {
  it('does not tell the reader a clamping setter refused the write', () => {
    // `set_page` clamps into [0, max - min] (range.cpp:254-255): it stores 0
    // rather than refusing the write.
    const message = check('page', '-1')?.message ?? '';
    expect(message).toContain('must be at least 0');
    expect(message).not.toContain('refuses the write');
  });

  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('Range')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format.
    const accepted = validatorRegistry
      .getOwnKeys('Range')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  // scene/gui/range.cpp:405: ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "min_value"), "set_min", "get_min");
  describe('min_value', () => {
    it('accepts a typical value', () => {
      expect(check('min_value', '0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('min_value', 'low')).not.toBeNull();
    });

    it('accepts a negative value — Range has no lower bound of its own', () => {
      expect(check('min_value', '-50.5')).toBeNull();
    });
  });

  // scene/gui/range.cpp:406: ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "max_value"), "set_max", "get_max");
  describe('max_value', () => {
    it('accepts a typical value', () => {
      expect(check('max_value', '100')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('max_value', 'high')).not.toBeNull();
    });

    it('accepts a value below min_value — Godot clamps at load time rather than rejecting it (range.cpp:210-ish set_max)', () => {
      expect(check('max_value', '-10')).toBeNull();
    });
  });

  // scene/gui/range.cpp:407: ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "step"), "set_step", "get_step");
  describe('step', () => {
    it('accepts a typical value', () => {
      expect(check('step', '0.01')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('step', 'chunky')).not.toBeNull();
    });

    it('accepts 0 — Range::_calc_value only snaps when step > 0, so 0 legitimately means "no snapping"', () => {
      expect(check('step', '0')).toBeNull();
    });
  });

  // scene/gui/range.cpp:408: ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "page"), "set_page", "get_page");
  describe('page', () => {
    it('accepts a typical value', () => {
      expect(check('page', '25')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('page', 'wide')).not.toBeNull();
    });

    it('accepts 0 — the Range default, meaning "no page"', () => {
      expect(check('page', '0')).toBeNull();
    });
  });

  // scene/gui/range.cpp:409: ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "value"), "set_value", "get_value");
  describe('value', () => {
    it('accepts a typical value', () => {
      expect(check('value', '42.5')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('value', 'lots')).not.toBeNull();
    });

    it('accepts scientific notation, which Godot itself writes for small floats', () => {
      expect(check('value', '4.37114e-08')).toBeNull();
    });
  });

  // scene/gui/range.cpp:411: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "exp_edit"), "set_exp_ratio", "is_ratio_exp");
  describe('exp_edit', () => {
    it('accepts true', () => {
      expect(check('exp_edit', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('exp_edit', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('exp_edit', 'yes')).not.toBeNull();
    });
  });

  // scene/gui/range.cpp:412: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "rounded"), "set_use_rounded_values", "is_using_rounded_values");
  describe('rounded', () => {
    it('accepts true', () => {
      expect(check('rounded', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('rounded', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('rounded', '1')).not.toBeNull();
    });
  });

  // scene/gui/range.cpp:413: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "allow_greater"), "set_allow_greater", "is_greater_allowed");
  describe('allow_greater', () => {
    it('accepts true', () => {
      expect(check('allow_greater', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('allow_greater', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('allow_greater', 'maybe')).not.toBeNull();
    });
  });

  // scene/gui/range.cpp:414: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "allow_lesser"), "set_allow_lesser", "is_lesser_allowed");
  describe('allow_lesser', () => {
    it('accepts true', () => {
      expect(check('allow_lesser', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('allow_lesser', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('allow_lesser', 'nope')).not.toBeNull();
    });
  });

  it('does not re-register ratio — bound PROPERTY_USAGE_NONE in range.cpp:410, so Godot never writes it to a .tscn', () => {
    expect(validatorRegistry.findValidator('Range', 'ratio')).toBeNull();
  });

  it('does not re-register size_flags_vertical — it carries overrides="Control" in Range.xml, so Control already owns it', () => {
    expect(validatorRegistry.getOwnKeys('Range')).not.toContain('size_flags_vertical');
  });
});

describe('Range.page, whose setter clamps rather than stores', () => {
  const page = (value: string) =>
    validatorRegistry.findValidator('Range', 'page')!('page', value, 1);

  it('reports a negative page, which range.cpp:255 CLAMPs up to 0', () => {
    const error = page('-1');
    expect(error?.severity).toBe('error');
    expect(error?.message).toContain('0');
  });

  it('takes 0 and any positive page', () => {
    expect(page('0')).toBeNull();
    expect(page('12.5')).toBeNull();
  });
});
