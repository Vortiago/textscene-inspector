/**
 * ConeTwistJoint3D strict validators, asserted through `validatorRegistry`, not by
 * linting a `.tscn`, so a failure points at the validator and no fixture text needs upkeep.
 * Rule-level behaviour belongs in linter.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('ConeTwistJoint3D', property);
  expect(validator, `no validator registered for ConeTwistJoint3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('ConeTwistJoint3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('ConeTwistJoint3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. This check is generic
    // on purpose, and per-property cases follow.
    const accepted = validatorRegistry
      .getOwnKeys('ConeTwistJoint3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  // cone_twist_joint_3d.cpp:37: PROPERTY_HINT_RANGE "-180,180,0.1,radians_as_degrees",
  // no or_greater/or_less: hard bound of ±π radians once converted. The XML
  // default 0.7853982 is π/4 (45°), consistent with degrees, not radians, in the hint.
  describe('swing_span', () => {
    it('accepts a value inside ±π radians', () => {
      expect(check('swing_span', '0.5')).toBeNull();
    });

    it('accepts the exact ±π bound', () => {
      expect(check('swing_span', Math.PI.toFixed(6))).toBeNull();
      expect(check('swing_span', (-Math.PI).toFixed(6))).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('swing_span', 'not-a-number');
      expect(error?.code).toBe('INVALID_SWING_SPAN_FORMAT');
    });

    // Proves the radian conversion: 4.0 is far inside the hint's raw ±180, yet past
    // the bound once the hint's degrees convert to the radians the value is serialised in.
    it('warns past ±π radians (the ±180 degree bound converted) rather than erroring (set_param index-guards only)', () => {
      const error = check('swing_span', '4.0');
      expect(error?.code).toBe('INVALID_SWING_SPAN_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // cone_twist_joint_3d.cpp:38: PROPERTY_HINT_RANGE "-40000,40000,0.1,radians_as_degrees",
  // no or_greater/or_less, so the large extent is still the bound. The XML default 3.1415927
  // is π (180°), well inside ±40000° converted to radians.
  describe('twist_span', () => {
    const maxRad = (40000 * Math.PI) / 180; // cone_twist_joint_3d.cpp:38: ±40000° converted

    it('accepts a value well inside the converted bound', () => {
      expect(check('twist_span', Math.PI.toFixed(6))).toBeNull();
    });

    it('accepts the exact converted bound', () => {
      expect(check('twist_span', maxRad.toFixed(6))).toBeNull();
      expect(check('twist_span', (-maxRad).toFixed(6))).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('twist_span', 'not-a-number');
      expect(error?.code).toBe('INVALID_TWIST_SPAN_FORMAT');
    });

    // Proves the radian conversion: 1000 is inside the hint's raw "-40000,40000", but the
    // bound, ±40000° converted to radians, is about 698.13, so 1000 is past it.
    it('warns past the converted bound (well within the raw ±40000 degree numbers) rather than erroring', () => {
      const error = check('twist_span', '1000');
      expect(error?.code).toBe('INVALID_TWIST_SPAN_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // cone_twist_joint_3d.cpp:40: PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  describe('bias', () => {
    it('accepts a value inside 0.01-16.0', () => {
      expect(check('bias', '0.3')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('bias', '0.01')).toBeNull();
      expect(check('bias', '16.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('bias', 'not-a-number');
      expect(error?.code).toBe('INVALID_BIAS_FORMAT');
    });

    it('warns past the hinted bound rather than erroring (set_param index-guards only)', () => {
      const error = check('bias', '16.5');
      expect(error?.code).toBe('INVALID_BIAS_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // cone_twist_joint_3d.cpp:41: PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  describe('softness', () => {
    it('accepts a value inside 0.01-16.0', () => {
      expect(check('softness', '0.8')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('softness', '0.01')).toBeNull();
      expect(check('softness', '16.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('softness', 'not-a-number');
      expect(error?.code).toBe('INVALID_SOFTNESS_FORMAT');
    });

    it('warns past the hinted bound rather than erroring (set_param index-guards only)', () => {
      const error = check('softness', '16.5');
      expect(error?.code).toBe('INVALID_SOFTNESS_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // cone_twist_joint_3d.cpp:42: PROPERTY_HINT_RANGE "0.01,16.0,0.01", both bounds hard.
  describe('relaxation', () => {
    it('accepts a value inside 0.01-16.0', () => {
      expect(check('relaxation', '1.0')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('relaxation', '0.01')).toBeNull();
      expect(check('relaxation', '16.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('relaxation', 'not-a-number');
      expect(error?.code).toBe('INVALID_RELAXATION_FORMAT');
    });

    it('warns past the hinted bound rather than erroring (set_param index-guards only)', () => {
      const error = check('relaxation', '16.5');
      expect(error?.code).toBe('INVALID_RELAXATION_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });
});
