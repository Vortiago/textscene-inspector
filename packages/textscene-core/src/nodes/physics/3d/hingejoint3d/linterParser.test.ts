/**
 * HingeJoint3D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('HingeJoint3D', property);
  expect(validator, `no validator registered for HingeJoint3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('HingeJoint3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('HingeJoint3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('HingeJoint3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  // hinge_joint_3d.cpp:40 — PROPERTY_HINT_RANGE "0.00,0.99,0.01", no or_greater/or_less: both bounds hard.
  describe('params/bias', () => {
    it('accepts a value inside 0.00-0.99', () => {
      expect(check('params/bias', '0.3')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('params/bias', '0.0')).toBeNull();
      expect(check('params/bias', '0.99')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('params/bias', 'not-a-number');
      expect(error?.code).toBe('INVALID_PARAMS/BIAS_FORMAT');
    });

    it('warns past the hinted bound rather than erroring (set_param index-guards only)', () => {
      const error = check('params/bias', '1.0');
      expect(error?.code).toBe('INVALID_PARAMS/BIAS_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // hinge_joint_3d.cpp:42 — plain BOOL, no hint (set_flag/get_flag on FLAG_USE_LIMIT).
  describe('angular_limit/enable', () => {
    it('accepts true and false', () => {
      expect(check('angular_limit/enable', 'true')).toBeNull();
      expect(check('angular_limit/enable', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('angular_limit/enable', 'maybe');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT/ENABLE_FORMAT');
    });
  });

  // hinge_joint_3d.cpp:43 — PROPERTY_HINT_RANGE "-180,180,0.1,radians_as_degrees",
  // no or_less/or_greater. The hint's degrees describe the inspector slider; the
  // value serialised into a .tscn is radians (doc/classes/HingeJoint3D.xml's
  // defaults -1.5707964/1.5707964 are -π/2 and π/2, not -90/90), so the hard
  // bound is ±π radians, not ±180.
  describe('angular_limit/upper', () => {
    it('accepts a value inside ±π radians', () => {
      expect(check('angular_limit/upper', '0.5')).toBeNull();
    });

    it('accepts the exact ±π bound', () => {
      expect(check('angular_limit/upper', Math.PI.toFixed(6))).toBeNull();
      expect(check('angular_limit/upper', (-Math.PI).toFixed(6))).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('angular_limit/upper', 'not-a-number');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT/UPPER_FORMAT');
    });

    // Proves the radian conversion: 4.0 is nowhere near the ±180 a naive
    // reader of the hint's raw degree numbers would expect as the bound, yet
    // it is well past the REAL bound once the hint's degrees are converted to
    // the radians the value is actually serialised in.
    it('warns past ±π radians (the ±180 degree bound converted) rather than erroring', () => {
      const error = check('angular_limit/upper', '4.0');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT/UPPER_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // hinge_joint_3d.cpp:44 — same hint shape as angular_limit/upper.
  describe('angular_limit/lower', () => {
    it('accepts a value inside ±π radians', () => {
      expect(check('angular_limit/lower', '-0.5')).toBeNull();
    });

    it('accepts the exact ±π bound', () => {
      expect(check('angular_limit/lower', Math.PI.toFixed(6))).toBeNull();
      expect(check('angular_limit/lower', (-Math.PI).toFixed(6))).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('angular_limit/lower', 'not-a-number');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT/LOWER_FORMAT');
    });

    it('warns past ±π radians (the ±180 degree bound converted) rather than erroring', () => {
      const error = check('angular_limit/lower', '-4.0');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT/LOWER_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // hinge_joint_3d.cpp:45 — PROPERTY_HINT_RANGE "0.01,0.99,0.01", both bounds hard.
  describe('angular_limit/bias', () => {
    it('accepts a value inside 0.01-0.99', () => {
      expect(check('angular_limit/bias', '0.3')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('angular_limit/bias', '0.01')).toBeNull();
      expect(check('angular_limit/bias', '0.99')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('angular_limit/bias', 'not-a-number');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT/BIAS_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('angular_limit/bias', '1.0');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT/BIAS_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // hinge_joint_3d.cpp:46 — PROPERTY_HINT_RANGE "0.01,16,0.01", both bounds hard.
  // Deprecated ("never set by the engine") but still a real ADD_PROPERTY, so it
  // still gets a validator.
  describe('angular_limit/softness', () => {
    it('accepts a value inside 0.01-16', () => {
      expect(check('angular_limit/softness', '0.9')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('angular_limit/softness', '0.01')).toBeNull();
      expect(check('angular_limit/softness', '16')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('angular_limit/softness', 'not-a-number');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT/SOFTNESS_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('angular_limit/softness', '16.5');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT/SOFTNESS_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // hinge_joint_3d.cpp:47 — PROPERTY_HINT_RANGE "0.01,16,0.01", both bounds hard.
  describe('angular_limit/relaxation', () => {
    it('accepts a value inside 0.01-16', () => {
      expect(check('angular_limit/relaxation', '1.0')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('angular_limit/relaxation', '0.01')).toBeNull();
      expect(check('angular_limit/relaxation', '16')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('angular_limit/relaxation', 'not-a-number');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT/RELAXATION_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('angular_limit/relaxation', '16.5');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT/RELAXATION_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // hinge_joint_3d.cpp:49 — plain BOOL, no hint (set_flag/get_flag on FLAG_ENABLE_MOTOR).
  describe('motor/enable', () => {
    it('accepts true and false', () => {
      expect(check('motor/enable', 'true')).toBeNull();
      expect(check('motor/enable', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('motor/enable', 'maybe');
      expect(error?.code).toBe('INVALID_MOTOR/ENABLE_FORMAT');
    });
  });

  // hinge_joint_3d.cpp:50 — PROPERTY_HINT_RANGE
  // "-200,200,0.01,or_greater,or_less,radians_as_degrees,suffix:°/s". Both
  // or_greater and or_less are present, so both ends are soft editor extents —
  // any finite float is legal.
  describe('motor/target_velocity', () => {
    it('accepts a value inside the soft slider extents', () => {
      expect(check('motor/target_velocity', '1.0')).toBeNull();
    });

    it('accepts a value beyond the soft slider extents (or_less/or_greater)', () => {
      expect(check('motor/target_velocity', '500.0')).toBeNull();
      expect(check('motor/target_velocity', '-500.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('motor/target_velocity', 'not-a-number');
      expect(error?.code).toBe('INVALID_MOTOR/TARGET_VELOCITY_FORMAT');
    });
  });

  // hinge_joint_3d.cpp:51 — PROPERTY_HINT_RANGE "0.01,1024,0.01", both bounds hard.
  describe('motor/max_impulse', () => {
    it('accepts a value inside 0.01-1024', () => {
      expect(check('motor/max_impulse', '1.0')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('motor/max_impulse', '0.01')).toBeNull();
      expect(check('motor/max_impulse', '1024')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('motor/max_impulse', 'not-a-number');
      expect(error?.code).toBe('INVALID_MOTOR/MAX_IMPULSE_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('motor/max_impulse', '1024.5');
      expect(error?.code).toBe('INVALID_MOTOR/MAX_IMPULSE_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });
});
