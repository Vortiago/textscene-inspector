/**
 * SpringBoneCollisionCapsule3D strict validators: format and range checks, asserted through
 * `validatorRegistry`. All three serialised properties are assigned straight through
 * (`scene/3d/spring_bone_collision_capsule_3d.cpp`), so the only bounds are the
 * `PROPERTY_HINT_RANGE` floors, which warn (ADR-0032).
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('SpringBoneCollisionCapsule3D', property);
  expect(validator, `no validator registered for SpringBoneCollisionCapsule3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly one, from the source rather than from expectation: list the keys
 * SpringBoneCollisionCapsule3D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY. Both
 * unset is red on purpose. Do not delete an assertion to go green.
 */
const KEYS: string[] = ['radius', 'height', 'inside'];
/** True only when the class binds no ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

describe('SpringBoneCollisionCapsule3D strict validators', () => {
  it('registers exactly what SpringBoneCollisionCapsule3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('SpringBoneCollisionCapsule3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // Runs the fixture's "zero errors and zero warnings" claim against the validators this test
    // imports. `fixtureLint` checks the same file against the whole registry.
    expectFixtureClean('unit-spring-bone-collision-capsule-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose validates no format. This loop is generic, and the
    // per-property cases follow.
    const accepted = validatorRegistry
      .getOwnKeys('SpringBoneCollisionCapsule3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('radius', () => {
    it('accepts the default and any larger radius', () => {
      // `,or_greater` opens the max end of "0,1,0.001,or_greater,suffix:m"
      // (spring_bone_collision_capsule_3d.cpp:101), so no ceiling is checkable.
      expect(check('radius', '0.1')).toBeNull();
      expect(check('radius', '0')).toBeNull();
      expect(check('radius', '48.5')).toBeNull();
    });

    it('warns below the hint floor of 0 without calling it an error', () => {
      // `set_radius` assigns `radius = p_radius` unaltered
      // (spring_bone_collision_capsule_3d.cpp:36) with no ERR_FAIL and no clamp, so
      // the floor is the inspector hint's alone and warns (ADR-0032).
      const error = check('radius', '-0.25');
      expect(error?.severity).toBe('warning');
      expect(error?.message).toContain('radius');
    });

    it('accepts the non-finite float literals Godot writes and reloads', () => {
      // variant_parser.cpp:150-155. No `is_finite` guard exists in set_radius.
      expect(check('radius', 'inf')).toBeNull();
      expect(check('radius', 'nan')).toBeNull();
    });

    it('rejects a non-numeric literal as a format error', () => {
      const error = check('radius', '"0.1"');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_RADIUS_FORMAT');
    });
  });

  describe('height', () => {
    it('accepts the default and any taller capsule', () => {
      // Same hint as radius, spring_bone_collision_capsule_3d.cpp:102.
      expect(check('height', '0.5')).toBeNull();
      expect(check('height', '0')).toBeNull();
      expect(check('height', '120')).toBeNull();
    });

    it('warns below the hint floor of 0 without calling it an error', () => {
      // `set_height` assigns `height = p_height` unaltered
      // (spring_bone_collision_capsule_3d.cpp:50).
      const error = check('height', '-1');
      expect(error?.severity).toBe('warning');
      expect(error?.message).toContain('height');
    });

    it('accepts the non-finite float literals Godot writes and reloads', () => {
      expect(check('height', 'inf')).toBeNull();
      expect(check('height', 'nan')).toBeNull();
    });
  });

  describe('inside', () => {
    it('accepts both boolean literals', () => {
      // spring_bone_collision_capsule_3d.cpp:104, PROPERTY_HINT_NONE.
      expect(check('inside', 'true')).toBeNull();
      expect(check('inside', 'false')).toBeNull();
    });

    it('rejects a numeric stand-in for a boolean', () => {
      const error = check('inside', '1');
      expect(error?.severity).toBe('warning');
      expect(error?.code).toBe('INVALID_INSIDE_FORMAT');
    });
  });

  it('declares no validator for mid_height, which never reaches a .tscn', () => {
    // spring_bone_collision_capsule_3d.cpp:103 binds it PROPERTY_USAGE_NONE, so
    // it is an editor-side wrapper over `height` and is never serialised. A
    // validator for it could only ever fire on a key Godot cannot write.
    expect(validatorRegistry.getOwnKeys('SpringBoneCollisionCapsule3D')).not.toContain('mid_height');
    expect(validatorRegistry.findValidator('SpringBoneCollisionCapsule3D', 'mid_height')).toBeNull();
  });

  it('inherits SpringBoneCollision3D keys through the base-walk rather than shadowing them', () => {
    // Resolving proves the walk reaches the ancestor, and absence from getOwnKeys proves this slice
    // did not re-declare it. A shadow satisfies either alone, and duplicates the ancestor's rule.
    expect(validatorRegistry.findValidator('SpringBoneCollisionCapsule3D', 'bone_name')).not.toBeNull();
    expect(validatorRegistry.getOwnKeys('SpringBoneCollisionCapsule3D')).not.toContain('bone_name');
    expect(validatorRegistry.findValidator('SpringBoneCollisionCapsule3D', 'position_offset')).not.toBeNull();
    expect(validatorRegistry.getOwnKeys('SpringBoneCollisionCapsule3D')).not.toContain('position_offset');
  });
});
