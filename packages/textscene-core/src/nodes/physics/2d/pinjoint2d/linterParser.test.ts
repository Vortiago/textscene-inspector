/**
 * PinJoint2D strict validators: format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * Grow this into one case per property (happy, malformed, and any bound) and
 * quote the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('PinJoint2D', property);
  expect(validator, `no validator registered for PinJoint2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('PinJoint2D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('PinJoint2D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('PinJoint2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  // pin_joint_2d.cpp:166, PROPERTY_HINT_RANGE "0.00,16,0.01,exp", no or_greater: both bounds hard.
  describe('softness', () => {
    it('accepts a value inside 0-16', () => {
      expect(check('softness', '4.5')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('softness', '0')).toBeNull();
      expect(check('softness', '16')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('softness', 'not-a-number');
      expect(error?.code).toBe('INVALID_SOFTNESS_FORMAT');
    });

    it('rejects a value past the hard bound', () => {
      const error = check('softness', '16.5');
      expect(error?.code).toBe('INVALID_SOFTNESS_VALUE');
    });
  });

  // pin_joint_2d.cpp:168, PROPERTY_HINT_GROUP_ENABLE, a plain bool field/setter.
  describe('angular_limit_enabled', () => {
    it('accepts true and false', () => {
      expect(check('angular_limit_enabled', 'true')).toBeNull();
      expect(check('angular_limit_enabled', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('angular_limit_enabled', 'maybe');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT_ENABLED_FORMAT');
    });
  });

  // pin_joint_2d.cpp:169, PROPERTY_HINT_RANGE "-180,180,0.1,radians_as_degrees",
  // no or_greater/or_less: hard bound of +/-pi radians once converted.
  describe('angular_limit_lower', () => {
    it('accepts a value inside +/-pi radians', () => {
      expect(check('angular_limit_lower', '-0.5')).toBeNull();
    });

    it('accepts the exact +/-pi bound', () => {
      expect(check('angular_limit_lower', Math.PI.toFixed(6))).toBeNull();
      expect(check('angular_limit_lower', (-Math.PI).toFixed(6))).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('angular_limit_lower', 'not-a-number');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT_LOWER_FORMAT');
    });

    it('rejects a value past +/-pi radians (the +/-180 degree bound converted to radians)', () => {
      const error = check('angular_limit_lower', '4.0');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT_LOWER_VALUE');
    });
  });

  // pin_joint_2d.cpp:170, same hint shape as angular_limit_lower.
  describe('angular_limit_upper', () => {
    it('accepts a value inside +/-pi radians', () => {
      expect(check('angular_limit_upper', '0.5')).toBeNull();
    });

    it('accepts the exact +/-pi bound', () => {
      expect(check('angular_limit_upper', Math.PI.toFixed(6))).toBeNull();
      expect(check('angular_limit_upper', (-Math.PI).toFixed(6))).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('angular_limit_upper', 'not-a-number');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT_UPPER_FORMAT');
    });

    it('rejects a value past +/-pi radians (the +/-180 degree bound converted to radians)', () => {
      const error = check('angular_limit_upper', '-4.0');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT_UPPER_VALUE');
    });
  });

  // pin_joint_2d.cpp:172, PROPERTY_HINT_GROUP_ENABLE, a plain bool field/setter.
  describe('motor_enabled', () => {
    it('accepts true and false', () => {
      expect(check('motor_enabled', 'true')).toBeNull();
      expect(check('motor_enabled', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('motor_enabled', 'maybe');
      expect(error?.code).toBe('INVALID_MOTOR_ENABLED_FORMAT');
    });
  });

  // pin_joint_2d.cpp:173, PROPERTY_HINT_RANGE "-200,200,0.01,or_greater,or_less,...".
  // or_greater/or_less make both bounds soft editor extents, not an enforced
  // range: any finite float is valid.
  describe('motor_target_velocity', () => {
    it('accepts a value inside the documented slider range', () => {
      expect(check('motor_target_velocity', '50.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('motor_target_velocity', 'not-a-number');
      expect(error?.code).toBe('INVALID_MOTOR_TARGET_VELOCITY_FORMAT');
    });

    it('accepts a value beyond the soft slider extents (or_greater/or_less)', () => {
      expect(check('motor_target_velocity', '2048.0')).toBeNull();
      expect(check('motor_target_velocity', '-2048.0')).toBeNull();
    });
  });
});
