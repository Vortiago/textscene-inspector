/**
 * AnimatableBody2D strict validators, asserted through `validatorRegistry`, not by
 * linting a `.tscn`, so a failure points at the validator and no fixture text needs upkeep.
 * Rule-level behaviour belongs in linter.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('AnimatableBody2D', property);
  expect(validator, `no validator registered for AnimatableBody2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('AnimatableBody2D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('AnimatableBody2D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. This check is generic
    // on purpose, and per-property cases follow.
    const accepted = validatorRegistry
      .getOwnKeys('AnimatableBody2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('sync_to_physics', () => {
    // scene/2d/physics/animatable_body_2d.cpp:
    // ADD_PROPERTY(PropertyInfo(Variant::BOOL, "sync_to_physics"), ...): plain bool, no hint.
    it('accepts "true"', () => {
      expect(check('sync_to_physics', 'true')).toBeNull();
    });

    it('accepts "false"', () => {
      expect(check('sync_to_physics', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('sync_to_physics', 'yes');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_SYNC_TO_PHYSICS_FORMAT');
    });
  });
});
