/**
 * SliderJoint3D strict validators - format and range checks.
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
  const validator = validatorRegistry.findValidator('SliderJoint3D', property);
  expect(validator, `no validator registered for SliderJoint3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('SliderJoint3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('SliderJoint3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('SliderJoint3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  // slider_joint_3d.cpp:37 - PROPERTY_HINT_RANGE "-1024,1024,0.01,suffix:m", no or_greater/or_less: both bounds hard.
  describe('linear_limit/upper_distance', () => {
    it('accepts a value inside -1024 to 1024', () => {
      expect(check('linear_limit/upper_distance', '1.0')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('linear_limit/upper_distance', '-1024')).toBeNull();
      expect(check('linear_limit/upper_distance', '1024')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('linear_limit/upper_distance', 'not-a-number');
      expect(error?.code).toBe('INVALID_LINEAR_LIMIT/UPPER_DISTANCE_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('linear_limit/upper_distance', '1024.5');
      expect(error?.code).toBe('INVALID_LINEAR_LIMIT/UPPER_DISTANCE_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // slider_joint_3d.cpp:38 - same hint shape as upper_distance.
  describe('linear_limit/lower_distance', () => {
    it('accepts a value inside -1024 to 1024', () => {
      expect(check('linear_limit/lower_distance', '-1.0')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('linear_limit/lower_distance', '-1024')).toBeNull();
      expect(check('linear_limit/lower_distance', '1024')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('linear_limit/lower_distance', 'not-a-number');
      expect(error?.code).toBe('INVALID_LINEAR_LIMIT/LOWER_DISTANCE_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('linear_limit/lower_distance', '-1024.5');
      expect(error?.code).toBe('INVALID_LINEAR_LIMIT/LOWER_DISTANCE_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // slider_joint_3d.cpp:39 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  describe('linear_limit/softness', () => {
    it('accepts a value inside 0.01-16.0', () => {
      expect(check('linear_limit/softness', '1.0')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('linear_limit/softness', '0.01')).toBeNull();
      expect(check('linear_limit/softness', '16.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('linear_limit/softness', 'not-a-number');
      expect(error?.code).toBe('INVALID_LINEAR_LIMIT/SOFTNESS_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('linear_limit/softness', '16.5');
      expect(error?.code).toBe('INVALID_LINEAR_LIMIT/SOFTNESS_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // slider_joint_3d.cpp:40 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  describe('linear_limit/restitution', () => {
    it('accepts a value inside 0.01-16.0', () => {
      expect(check('linear_limit/restitution', '0.7')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('linear_limit/restitution', '0.01')).toBeNull();
      expect(check('linear_limit/restitution', '16.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('linear_limit/restitution', 'not-a-number');
      expect(error?.code).toBe('INVALID_LINEAR_LIMIT/RESTITUTION_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('linear_limit/restitution', '16.5');
      expect(error?.code).toBe('INVALID_LINEAR_LIMIT/RESTITUTION_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // slider_joint_3d.cpp:41 - PROPERTY_HINT_RANGE "0,16.0,0.01", both bounds hard.
  describe('linear_limit/damping', () => {
    it('accepts a value inside 0-16.0', () => {
      expect(check('linear_limit/damping', '1.0')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('linear_limit/damping', '0')).toBeNull();
      expect(check('linear_limit/damping', '16.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('linear_limit/damping', 'not-a-number');
      expect(error?.code).toBe('INVALID_LINEAR_LIMIT/DAMPING_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('linear_limit/damping', '-0.5');
      expect(error?.code).toBe('INVALID_LINEAR_LIMIT/DAMPING_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // slider_joint_3d.cpp:42 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  describe('linear_motion/softness', () => {
    it('accepts a value inside 0.01-16.0', () => {
      expect(check('linear_motion/softness', '1.0')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('linear_motion/softness', '0.01')).toBeNull();
      expect(check('linear_motion/softness', '16.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('linear_motion/softness', 'not-a-number');
      expect(error?.code).toBe('INVALID_LINEAR_MOTION/SOFTNESS_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('linear_motion/softness', '0.0');
      expect(error?.code).toBe('INVALID_LINEAR_MOTION/SOFTNESS_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // slider_joint_3d.cpp:43 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  describe('linear_motion/restitution', () => {
    it('accepts a value inside 0.01-16.0', () => {
      expect(check('linear_motion/restitution', '0.7')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('linear_motion/restitution', '0.01')).toBeNull();
      expect(check('linear_motion/restitution', '16.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('linear_motion/restitution', 'not-a-number');
      expect(error?.code).toBe('INVALID_LINEAR_MOTION/RESTITUTION_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('linear_motion/restitution', '16.5');
      expect(error?.code).toBe('INVALID_LINEAR_MOTION/RESTITUTION_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // slider_joint_3d.cpp:44 - PROPERTY_HINT_RANGE "0,16.0,0.01", both bounds hard.
  describe('linear_motion/damping', () => {
    it('accepts a value inside 0-16.0', () => {
      expect(check('linear_motion/damping', '0.0')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('linear_motion/damping', '0')).toBeNull();
      expect(check('linear_motion/damping', '16.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('linear_motion/damping', 'not-a-number');
      expect(error?.code).toBe('INVALID_LINEAR_MOTION/DAMPING_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('linear_motion/damping', '16.1');
      expect(error?.code).toBe('INVALID_LINEAR_MOTION/DAMPING_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // slider_joint_3d.cpp:45 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  describe('linear_ortho/softness', () => {
    it('accepts a value inside 0.01-16.0', () => {
      expect(check('linear_ortho/softness', '1.0')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('linear_ortho/softness', '0.01')).toBeNull();
      expect(check('linear_ortho/softness', '16.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('linear_ortho/softness', 'not-a-number');
      expect(error?.code).toBe('INVALID_LINEAR_ORTHO/SOFTNESS_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('linear_ortho/softness', '16.5');
      expect(error?.code).toBe('INVALID_LINEAR_ORTHO/SOFTNESS_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // slider_joint_3d.cpp:46 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  describe('linear_ortho/restitution', () => {
    it('accepts a value inside 0.01-16.0', () => {
      expect(check('linear_ortho/restitution', '0.7')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('linear_ortho/restitution', '0.01')).toBeNull();
      expect(check('linear_ortho/restitution', '16.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('linear_ortho/restitution', 'not-a-number');
      expect(error?.code).toBe('INVALID_LINEAR_ORTHO/RESTITUTION_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('linear_ortho/restitution', '16.5');
      expect(error?.code).toBe('INVALID_LINEAR_ORTHO/RESTITUTION_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // slider_joint_3d.cpp:47 - PROPERTY_HINT_RANGE "0,16.0,0.01", both bounds hard.
  describe('linear_ortho/damping', () => {
    it('accepts a value inside 0-16.0', () => {
      expect(check('linear_ortho/damping', '1.0')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('linear_ortho/damping', '0')).toBeNull();
      expect(check('linear_ortho/damping', '16.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('linear_ortho/damping', 'not-a-number');
      expect(error?.code).toBe('INVALID_LINEAR_ORTHO/DAMPING_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('linear_ortho/damping', '-0.1');
      expect(error?.code).toBe('INVALID_LINEAR_ORTHO/DAMPING_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // slider_joint_3d.cpp:49 - PROPERTY_HINT_RANGE "-180,180,0.1,radians_as_degrees",
  // no or_less/or_greater. The hint's degrees describe the inspector slider; the
  // value serialised into a .tscn is radians, so the hard bound is ±π radians,
  // not ±180.
  describe('angular_limit/upper_angle', () => {
    it('accepts a value inside ±π radians', () => {
      expect(check('angular_limit/upper_angle', '0.5')).toBeNull();
    });

    it('accepts the exact ±π bound', () => {
      expect(check('angular_limit/upper_angle', Math.PI.toFixed(6))).toBeNull();
      expect(check('angular_limit/upper_angle', (-Math.PI).toFixed(6))).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('angular_limit/upper_angle', 'not-a-number');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT/UPPER_ANGLE_FORMAT');
    });

    // Proves the radian conversion: 4.0 is nowhere near the ±180 a naive
    // reader of the hint's raw degree numbers would expect as the bound, yet
    // it is well past the REAL bound once the hint's degrees are converted to
    // the radians the value is actually serialised in.
    it('warns past ±π radians (the ±180 degree bound converted) rather than erroring', () => {
      const error = check('angular_limit/upper_angle', '4.0');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT/UPPER_ANGLE_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // slider_joint_3d.cpp:50 - same hint shape as upper_angle.
  describe('angular_limit/lower_angle', () => {
    it('accepts a value inside ±π radians', () => {
      expect(check('angular_limit/lower_angle', '-0.5')).toBeNull();
    });

    it('accepts the exact ±π bound', () => {
      expect(check('angular_limit/lower_angle', Math.PI.toFixed(6))).toBeNull();
      expect(check('angular_limit/lower_angle', (-Math.PI).toFixed(6))).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('angular_limit/lower_angle', 'not-a-number');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT/LOWER_ANGLE_FORMAT');
    });

    it('warns past ±π radians (the ±180 degree bound converted) rather than erroring', () => {
      const error = check('angular_limit/lower_angle', '-4.0');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT/LOWER_ANGLE_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // slider_joint_3d.cpp:51 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  describe('angular_limit/softness', () => {
    it('accepts a value inside 0.01-16.0', () => {
      expect(check('angular_limit/softness', '1.0')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('angular_limit/softness', '0.01')).toBeNull();
      expect(check('angular_limit/softness', '16.0')).toBeNull();
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

  // slider_joint_3d.cpp:52 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  describe('angular_limit/restitution', () => {
    it('accepts a value inside 0.01-16.0', () => {
      expect(check('angular_limit/restitution', '0.7')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('angular_limit/restitution', '0.01')).toBeNull();
      expect(check('angular_limit/restitution', '16.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('angular_limit/restitution', 'not-a-number');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT/RESTITUTION_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('angular_limit/restitution', '16.5');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT/RESTITUTION_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // slider_joint_3d.cpp:53 - PROPERTY_HINT_RANGE "0,16.0,0.01", both bounds hard.
  describe('angular_limit/damping', () => {
    it('accepts a value inside 0-16.0', () => {
      expect(check('angular_limit/damping', '0.0')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('angular_limit/damping', '0')).toBeNull();
      expect(check('angular_limit/damping', '16.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('angular_limit/damping', 'not-a-number');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT/DAMPING_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('angular_limit/damping', '16.1');
      expect(error?.code).toBe('INVALID_ANGULAR_LIMIT/DAMPING_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // slider_joint_3d.cpp:54 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  describe('angular_motion/softness', () => {
    it('accepts a value inside 0.01-16.0', () => {
      expect(check('angular_motion/softness', '1.0')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('angular_motion/softness', '0.01')).toBeNull();
      expect(check('angular_motion/softness', '16.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('angular_motion/softness', 'not-a-number');
      expect(error?.code).toBe('INVALID_ANGULAR_MOTION/SOFTNESS_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('angular_motion/softness', '0.0');
      expect(error?.code).toBe('INVALID_ANGULAR_MOTION/SOFTNESS_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // slider_joint_3d.cpp:55 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  describe('angular_motion/restitution', () => {
    it('accepts a value inside 0.01-16.0', () => {
      expect(check('angular_motion/restitution', '0.7')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('angular_motion/restitution', '0.01')).toBeNull();
      expect(check('angular_motion/restitution', '16.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('angular_motion/restitution', 'not-a-number');
      expect(error?.code).toBe('INVALID_ANGULAR_MOTION/RESTITUTION_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('angular_motion/restitution', '16.5');
      expect(error?.code).toBe('INVALID_ANGULAR_MOTION/RESTITUTION_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // slider_joint_3d.cpp:56 - PROPERTY_HINT_RANGE "0,16.0,0.01", both bounds hard.
  describe('angular_motion/damping', () => {
    it('accepts a value inside 0-16.0', () => {
      expect(check('angular_motion/damping', '1.0')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('angular_motion/damping', '0')).toBeNull();
      expect(check('angular_motion/damping', '16.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('angular_motion/damping', 'not-a-number');
      expect(error?.code).toBe('INVALID_ANGULAR_MOTION/DAMPING_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('angular_motion/damping', '-0.5');
      expect(error?.code).toBe('INVALID_ANGULAR_MOTION/DAMPING_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // slider_joint_3d.cpp:57 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  describe('angular_ortho/softness', () => {
    it('accepts a value inside 0.01-16.0', () => {
      expect(check('angular_ortho/softness', '1.0')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('angular_ortho/softness', '0.01')).toBeNull();
      expect(check('angular_ortho/softness', '16.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('angular_ortho/softness', 'not-a-number');
      expect(error?.code).toBe('INVALID_ANGULAR_ORTHO/SOFTNESS_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('angular_ortho/softness', '16.5');
      expect(error?.code).toBe('INVALID_ANGULAR_ORTHO/SOFTNESS_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // slider_joint_3d.cpp:58 - PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  describe('angular_ortho/restitution', () => {
    it('accepts a value inside 0.01-16.0', () => {
      expect(check('angular_ortho/restitution', '0.7')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('angular_ortho/restitution', '0.01')).toBeNull();
      expect(check('angular_ortho/restitution', '16.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('angular_ortho/restitution', 'not-a-number');
      expect(error?.code).toBe('INVALID_ANGULAR_ORTHO/RESTITUTION_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('angular_ortho/restitution', '16.5');
      expect(error?.code).toBe('INVALID_ANGULAR_ORTHO/RESTITUTION_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // slider_joint_3d.cpp:59 - PROPERTY_HINT_RANGE "0,16.0,0.01", both bounds hard.
  describe('angular_ortho/damping', () => {
    it('accepts a value inside 0-16.0', () => {
      expect(check('angular_ortho/damping', '1.0')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('angular_ortho/damping', '0')).toBeNull();
      expect(check('angular_ortho/damping', '16.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('angular_ortho/damping', 'not-a-number');
      expect(error?.code).toBe('INVALID_ANGULAR_ORTHO/DAMPING_FORMAT');
    });

    it('warns past the hinted bound rather than erroring', () => {
      const error = check('angular_ortho/damping', '-0.1');
      expect(error?.code).toBe('INVALID_ANGULAR_ORTHO/DAMPING_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });
});
