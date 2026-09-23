/**
 * RayCast2D strict validators, asserted through `validatorRegistry`, not by
 * linting a `.tscn`, so a failure points at the validator and no fixture text needs upkeep.
 * Rule-level behaviour belongs in linter.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('RayCast2D', property);
  expect(validator, `no validator registered for RayCast2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('RayCast2D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('RayCast2D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. This check is generic
    // on purpose, and per-property cases follow.
    const accepted = validatorRegistry
      .getOwnKeys('RayCast2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('boolean flags', () => {
    const booleanProps = [
      'enabled',
      'exclude_parent',
      'hit_from_inside',
      'collide_with_areas',
      'collide_with_bodies',
    ];

    it.each(booleanProps)('accepts "true" and "false" for %s', (property) => {
      expect(check(property, 'true')).toBeNull();
      expect(check(property, 'false')).toBeNull();
    });

    it.each(booleanProps)('rejects a non-boolean value for %s', (property) => {
      const error = check(property, 'yes');
      expect(error).not.toBeNull();
      expect(error!.code).toBe(`INVALID_${property.toUpperCase()}_FORMAT`);
    });
  });

  describe('target_position', () => {
    // scene/2d/physics/ray_cast_2d.cpp: ADD_PROPERTY(..., "target_position", PROPERTY_HINT_NONE, "suffix:px")
    it('accepts a Vector2 literal', () => {
      expect(check('target_position', 'Vector2(0, 50)')).toBeNull();
    });

    it('accepts negative and fractional components', () => {
      expect(check('target_position', 'Vector2(-12.5, 0.25)')).toBeNull();
    });

    it('rejects a value that is not a Vector2 literal', () => {
      const error = check('target_position', '50');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_TARGET_POSITION_FORMAT');
    });
  });

  describe('collision_mask', () => {
    // scene/2d/physics/ray_cast_2d.cpp: ADD_PROPERTY(PropertyInfo(Variant::INT, "collision_mask", PROPERTY_HINT_LAYERS_2D_PHYSICS), ...)
    it('accepts a single-layer mask', () => {
      expect(check('collision_mask', '1')).toBeNull();
    });

    it('accepts zero (no layers)', () => {
      expect(check('collision_mask', '0')).toBeNull();
    });

    it('accepts the full 32-bit mask', () => {
      expect(check('collision_mask', '4294967295')).toBeNull();
    });

    it('rejects a non-numeric mask', () => {
      const error = check('collision_mask', 'not-a-number');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_COLLISION_MASK_FORMAT');
    });

    it('accepts a negative mask, and refuses one past the 32-bit band', () => {
      // The 32-checkbox widget renders every 32-bit pattern, and Godot
      // stores -1 as all layers on, so nothing fires inside the band.
      expect(check('collision_mask', '-1')).toBeNull();
      expect(check('collision_mask', '4294967296')?.severity).toBe('error');
    });

    it('rejects a mask beyond the 32-bit range', () => {
      const error = check('collision_mask', '4294967296');
      expect(error).not.toBeNull();
      expect(error!.code).toBe('INVALID_COLLISION_MASK_VALUE');
    });
  });
});
