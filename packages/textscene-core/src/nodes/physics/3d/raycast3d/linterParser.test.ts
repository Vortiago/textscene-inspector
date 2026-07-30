/**
 * RayCast3D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour is the shared cast factory's and is tested
 * once beside it, in linter/physics/castLinterRule.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('RayCast3D', property);
  expect(validator, `no validator registered for RayCast3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('RayCast3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('RayCast3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('RayCast3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('enabled', () => {
    it('accepts true', () => {
      expect(check('enabled', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('enabled', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('enabled', '1');
      expect(error).not.toBeNull();
      expect(error?.code).toBe('INVALID_ENABLED_FORMAT');
    });
  });

  describe('exclude_parent', () => {
    it('accepts the default true', () => {
      expect(check('exclude_parent', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('exclude_parent', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('exclude_parent', 'yes');
      expect(error).not.toBeNull();
      expect(error?.code).toBe('INVALID_EXCLUDE_PARENT_FORMAT');
    });
  });

  describe('target_position', () => {
    it('accepts the default Vector3(0, -1, 0)', () => {
      expect(check('target_position', 'Vector3(0, -1, 0)')).toBeNull();
    });

    it('accepts an arbitrary Vector3', () => {
      expect(check('target_position', 'Vector3(1.5, -3, 0)')).toBeNull();
    });

    it('rejects a Vector2 (wrong arity)', () => {
      const error = check('target_position', 'Vector2(0, -1)');
      expect(error).not.toBeNull();
      expect(error?.code).toBe('INVALID_TARGET_POSITION_FORMAT');
    });
  });

  describe('collision_mask', () => {
    it('accepts the default (layer 1 only)', () => {
      expect(check('collision_mask', '1')).toBeNull();
    });

    it('accepts 0 (no layers)', () => {
      expect(check('collision_mask', '0')).toBeNull();
    });

    it('accepts the maximum 32-bit mask', () => {
      expect(check('collision_mask', '4294967295')).toBeNull();
    });

    it('rejects a value past the 32-bit mask as out of range, not malformed', () => {
      expect(check('collision_mask', '4294967296')?.code).toBe('INVALID_COLLISION_MASK_VALUE');
    });

    it('rejects a non-numeric value as malformed', () => {
      expect(check('collision_mask', 'all')?.code).toBe('INVALID_COLLISION_MASK_FORMAT');
    });
  });

  describe('hit_from_inside', () => {
    it('accepts the default false', () => {
      expect(check('hit_from_inside', 'false')).toBeNull();
    });

    it('accepts true', () => {
      expect(check('hit_from_inside', 'true')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('hit_from_inside', 'maybe');
      expect(error).not.toBeNull();
      expect(error?.code).toBe('INVALID_HIT_FROM_INSIDE_FORMAT');
    });
  });

  describe('hit_back_faces', () => {
    it('accepts the default true', () => {
      expect(check('hit_back_faces', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('hit_back_faces', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('hit_back_faces', '0');
      expect(error).not.toBeNull();
      expect(error?.code).toBe('INVALID_HIT_BACK_FACES_FORMAT');
    });
  });

  describe('collide_with_areas', () => {
    it('accepts the default false', () => {
      expect(check('collide_with_areas', 'false')).toBeNull();
    });

    it('accepts true', () => {
      expect(check('collide_with_areas', 'true')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('collide_with_areas', 'nope');
      expect(error).not.toBeNull();
      expect(error?.code).toBe('INVALID_COLLIDE_WITH_AREAS_FORMAT');
    });
  });

  describe('collide_with_bodies', () => {
    it('accepts the default true', () => {
      expect(check('collide_with_bodies', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('collide_with_bodies', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('collide_with_bodies', 'nope');
      expect(error).not.toBeNull();
      expect(error?.code).toBe('INVALID_COLLIDE_WITH_BODIES_FORMAT');
    });
  });

  describe('debug_shape_custom_color', () => {
    it('accepts the default Color(0, 0, 0, 1)', () => {
      expect(check('debug_shape_custom_color', 'Color(0, 0, 0, 1)')).toBeNull();
    });

    it('accepts an arbitrary Color', () => {
      expect(check('debug_shape_custom_color', 'Color(1, 0, 0, 1)')).toBeNull();
    });

    it('rejects a Color missing a component', () => {
      const error = check('debug_shape_custom_color', 'Color(1, 0, 0)');
      expect(error).not.toBeNull();
      expect(error?.code).toBe('INVALID_DEBUG_SHAPE_CUSTOM_COLOR_FORMAT');
    });
  });

  describe('debug_shape_thickness', () => {
    // scene/3d/physics/ray_cast_3d.cpp:390: PROPERTY_HINT_RANGE, "1,5" — a hard
    // bound (no `,or_greater`), so both ends are enforceable.
    it('accepts the default 2', () => {
      expect(check('debug_shape_thickness', '2')).toBeNull();
    });

    it('accepts the lower bound 1', () => {
      expect(check('debug_shape_thickness', '1')).toBeNull();
    });

    it('accepts the upper bound 5', () => {
      expect(check('debug_shape_thickness', '5')).toBeNull();
    });

    it('rejects 0 and 6 as out of range, not malformed', () => {
      expect(check('debug_shape_thickness', '0')?.code).toBe('INVALID_DEBUG_SHAPE_THICKNESS_VALUE');
      expect(check('debug_shape_thickness', '6')?.code).toBe('INVALID_DEBUG_SHAPE_THICKNESS_VALUE');
    });

    it('rejects a non-numeric value as malformed', () => {
      expect(check('debug_shape_thickness', 'thick')?.code).toBe(
        'INVALID_DEBUG_SHAPE_THICKNESS_FORMAT'
      );
    });
  });
});
