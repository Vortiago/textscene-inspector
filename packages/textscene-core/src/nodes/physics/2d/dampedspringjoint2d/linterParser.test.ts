/**
 * DampedSpringJoint2D strict validators — format and range checks.
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
  const validator = validatorRegistry.findValidator('DampedSpringJoint2D', property);
  expect(validator, `no validator registered for DampedSpringJoint2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('DampedSpringJoint2D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('DampedSpringJoint2D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('DampedSpringJoint2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('length', () => {
    // damped_spring_joint_2d.cpp:121, PROPERTY_HINT_RANGE, "1,65535,1,exp,suffix:px"
    it('accepts the documented default', () => {
      expect(check('length', '50.0')).toBeNull();
    });

    it('accepts the minimum bound', () => {
      expect(check('length', '1')).toBeNull();
    });

    it('accepts the maximum bound', () => {
      expect(check('length', '65535')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('length', 'far');
      expect(error?.code).toBe('INVALID_LENGTH_FORMAT');
    });

    it('warns below the minimum bound rather than erroring (set_length is bare)', () => {
      const error = check('length', '0');
      expect(error?.code).toBe('INVALID_LENGTH_VALUE');
      expect(error?.severity).toBe('warning');
    });

    it('warns beyond the 65535 cap (no or_greater on this hint) rather than erroring', () => {
      const error = check('length', '65536');
      expect(error?.code).toBe('INVALID_LENGTH_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  describe('rest_length', () => {
    // damped_spring_joint_2d.cpp:122, PROPERTY_HINT_RANGE, "0,65535,1,exp,suffix:px"
    it('accepts the documented default', () => {
      expect(check('rest_length', '0.0')).toBeNull();
    });

    it('accepts the maximum bound', () => {
      expect(check('rest_length', '65535')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('rest_length', 'none');
      expect(error?.code).toBe('INVALID_REST_LENGTH_FORMAT');
    });

    it('warns on a negative value rather than erroring (set_rest_length is bare)', () => {
      const error = check('rest_length', '-1');
      expect(error?.code).toBe('INVALID_REST_LENGTH_VALUE');
      expect(error?.severity).toBe('warning');
    });

    it('warns beyond the 65535 cap (no or_greater on this hint) rather than erroring', () => {
      const error = check('rest_length', '65536');
      expect(error?.code).toBe('INVALID_REST_LENGTH_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  describe('stiffness', () => {
    // damped_spring_joint_2d.cpp:123, PROPERTY_HINT_RANGE, "0.1,64,0.1,exp"
    it('accepts the minimum bound', () => {
      expect(check('stiffness', '0.1')).toBeNull();
    });

    it('accepts the documented default', () => {
      expect(check('stiffness', '20.0')).toBeNull();
    });

    it('accepts the maximum bound', () => {
      expect(check('stiffness', '64')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('stiffness', 'stiff');
      expect(error?.code).toBe('INVALID_STIFFNESS_FORMAT');
    });

    it('warns below the 0.1 floor (no or_greater on this hint) rather than erroring', () => {
      const error = check('stiffness', '0');
      expect(error?.code).toBe('INVALID_STIFFNESS_VALUE');
      expect(error?.severity).toBe('warning');
    });

    it('warns beyond the 64 cap (no or_greater on this hint) rather than erroring', () => {
      const error = check('stiffness', '64.1');
      expect(error?.code).toBe('INVALID_STIFFNESS_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  describe('damping', () => {
    // damped_spring_joint_2d.cpp:124, PROPERTY_HINT_RANGE, "0.01,16,0.01,exp"
    it('accepts the minimum bound', () => {
      expect(check('damping', '0.01')).toBeNull();
    });

    it('accepts the documented default', () => {
      expect(check('damping', '1.0')).toBeNull();
    });

    it('accepts the maximum bound', () => {
      expect(check('damping', '16')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('damping', 'soft');
      expect(error?.code).toBe('INVALID_DAMPING_FORMAT');
    });

    it('warns below the 0.01 floor (no or_greater on this hint) rather than erroring', () => {
      const error = check('damping', '0');
      expect(error?.code).toBe('INVALID_DAMPING_VALUE');
      expect(error?.severity).toBe('warning');
    });

    it('warns beyond the 16 cap (no or_greater on this hint) rather than erroring', () => {
      const error = check('damping', '16.01');
      expect(error?.code).toBe('INVALID_DAMPING_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });
});
