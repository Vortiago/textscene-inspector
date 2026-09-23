/**
 * GrooveJoint2D strict validators, asserted through `validatorRegistry`, not by
 * linting a `.tscn`, so a failure points at the validator and no fixture text needs upkeep.
 * Rule-level behaviour belongs in linter.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('GrooveJoint2D', property);
  expect(validator, `no validator registered for GrooveJoint2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('GrooveJoint2D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('GrooveJoint2D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. This check is generic
    // on purpose, and per-property cases follow.
    const accepted = validatorRegistry
      .getOwnKeys('GrooveJoint2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  // scene/2d/physics/joints/groove_joint_2d.cpp: ADD_PROPERTY(..., "length",
  // PROPERTY_HINT_RANGE, "1,65535,1,exp,suffix:px"), no or_greater/or_less.
  describe('length', () => {
    it('accepts the default 50.0', () => {
      expect(check('length', '50.0')).toBeNull();
    });

    it('accepts the lower bound 1', () => {
      expect(check('length', '1')).toBeNull();
    });

    it('accepts the upper bound 65535', () => {
      expect(check('length', '65535')).toBeNull();
    });

    it('rejects a non-numeric value as malformed', () => {
      expect(check('length', 'long')?.code).toBe('INVALID_LENGTH_FORMAT');
    });

    it('warns below the lower bound (set_length is a bare assignment)', () => {
      const error = check('length', '0');
      expect(error?.code).toBe('INVALID_LENGTH_VALUE');
      expect(error?.severity).toBe('warning');
    });

    it('warns above the upper bound rather than erroring', () => {
      const error = check('length', '65536');
      expect(error?.code).toBe('INVALID_LENGTH_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // scene/2d/physics/joints/groove_joint_2d.cpp: ADD_PROPERTY(..., "initial_offset",
  // PROPERTY_HINT_RANGE, "1,65535,1,exp,suffix:px"), no or_greater/or_less.
  describe('initial_offset', () => {
    it('accepts the default 25.0', () => {
      expect(check('initial_offset', '25.0')).toBeNull();
    });

    it('accepts the lower bound 1', () => {
      expect(check('initial_offset', '1')).toBeNull();
    });

    it('accepts the upper bound 65535', () => {
      expect(check('initial_offset', '65535')).toBeNull();
    });

    it('rejects a non-numeric value as malformed', () => {
      expect(check('initial_offset', 'far')?.code).toBe('INVALID_INITIAL_OFFSET_FORMAT');
    });

    it('warns below the lower bound (set_initial_offset is a bare assignment)', () => {
      const error = check('initial_offset', '0');
      expect(error?.code).toBe('INVALID_INITIAL_OFFSET_VALUE');
      expect(error?.severity).toBe('warning');
    });

    it('warns above the upper bound rather than erroring', () => {
      const error = check('initial_offset', '65536');
      expect(error?.code).toBe('INVALID_INITIAL_OFFSET_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });
});
