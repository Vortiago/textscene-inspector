/**
 * AnimatableBody3D strict validators, asserted through `validatorRegistry`, not by
 * linting a `.tscn`, so a failure points at the validator and no fixture text needs upkeep.
 * AnimatableBody3D registers no semantic rule, so there is no linter.ts to test.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('AnimatableBody3D', property);
  expect(validator, `no validator registered for AnimatableBody3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('AnimatableBody3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('AnimatableBody3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. This check is generic
    // on purpose, and per-property cases follow.
    const accepted = validatorRegistry
      .getOwnKeys('AnimatableBody3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('sync_to_physics', () => {
    it('accepts the default true', () => {
      expect(check('sync_to_physics', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('sync_to_physics', 'false')).toBeNull();
    });

    it('rejects a non-boolean value as malformed', () => {
      expect(check('sync_to_physics', '1')?.code).toBe('INVALID_SYNC_TO_PHYSICS_FORMAT');
    });
  });
});
