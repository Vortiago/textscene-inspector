/**
 * PinJoint3D strict validators — format and range checks.
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
  const validator = validatorRegistry.findValidator('PinJoint3D', property);
  expect(validator, `no validator registered for PinJoint3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('PinJoint3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('PinJoint3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('PinJoint3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  // pin_joint_3d.cpp:37 — PROPERTY_HINT_RANGE "0.01,0.99,0.01", no or_greater/or_less: both bounds hard.
  describe('params/bias', () => {
    it('accepts a value inside 0.01-0.99', () => {
      expect(check('params/bias', '0.3')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('params/bias', '0.01')).toBeNull();
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

  // pin_joint_3d.cpp:38 — PROPERTY_HINT_RANGE "0.01,8.0,0.01", no or_greater/or_less: both bounds hard.
  describe('params/damping', () => {
    it('accepts a value inside 0.01-8.0', () => {
      expect(check('params/damping', '1.0')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('params/damping', '0.01')).toBeNull();
      expect(check('params/damping', '8.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('params/damping', 'not-a-number');
      expect(error?.code).toBe('INVALID_PARAMS/DAMPING_FORMAT');
    });

    it('warns past the hinted bound rather than erroring (set_param index-guards only)', () => {
      const error = check('params/damping', '8.5');
      expect(error?.code).toBe('INVALID_PARAMS/DAMPING_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // pin_joint_3d.cpp:39 — PROPERTY_HINT_RANGE "0.0,64.0,0.01", no or_greater/or_less: both bounds hard.
  describe('params/impulse_clamp', () => {
    it('accepts a value inside 0.0-64.0', () => {
      expect(check('params/impulse_clamp', '32.0')).toBeNull();
    });

    it('accepts the exact bounds', () => {
      expect(check('params/impulse_clamp', '0.0')).toBeNull();
      expect(check('params/impulse_clamp', '64.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('params/impulse_clamp', 'not-a-number');
      expect(error?.code).toBe('INVALID_PARAMS/IMPULSE_CLAMP_FORMAT');
    });

    it('warns past the hinted bound rather than erroring (set_param index-guards only)', () => {
      const error = check('params/impulse_clamp', '64.5');
      expect(error?.code).toBe('INVALID_PARAMS/IMPULSE_CLAMP_VALUE');
      expect(error?.severity).toBe('warning');
    });

    it('warns on a negative value rather than erroring', () => {
      const error = check('params/impulse_clamp', '-1.0');
      expect(error?.code).toBe('INVALID_PARAMS/IMPULSE_CLAMP_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });
});
