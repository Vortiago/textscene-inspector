/**
 * SpringBoneCollisionPlane3D strict validators: coverage and base-walk checks. The class binds
 * nothing of its own (linterParser.ts has the four-route proof), so the tests assert that the
 * base-walk reaches every inherited key a scene can set on a plane, and that this type re-declares
 * none of them.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import { checkerFor } from '../../../../linter/testing/validatorCheck';
import './linterParser';

/** `SpringBoneCollisionPlane3D.<property>`'s registered validator, invoked at line 1. */
const check = checkerFor('SpringBoneCollisionPlane3D');

/**
 * Set exactly one, from the source rather than from expectation: list the keys
 * SpringBoneCollisionPlane3D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY. Both
 * unset is red on purpose. Do not delete an assertion to go green.
 */
const KEYS: string[] = [];
/**
 * True: no route binds a property. scene/3d/spring_bone_collision_plane_3d.cpp:31-43 is an include
 * plus the `_collide` override, with no `_bind_methods` or `.compat.inc`.
 * scene/3d/spring_bone_collision_plane_3d.h:38-39 declares only that override, and
 * doc/classes/SpringBoneCollisionPlane3D.xml has no `<members>`.
 */
const DECLARES_NOTHING = true;

describe('SpringBoneCollisionPlane3D strict validators', () => {
  it('registers exactly what SpringBoneCollisionPlane3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('SpringBoneCollisionPlane3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // Runs the fixture's "zero errors and zero warnings" claim against the validators this test
    // imports. `fixtureLint` checks the same file against the whole registry. With no own keys,
    // that is the inherited validators from SpringBoneCollision3D up.
    expectFixtureClean('unit-spring-bone-collision-plane-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. Empty
    // while the class owns no key, and live the moment anyone adds one.
    const accepted = validatorRegistry
      .getOwnKeys('SpringBoneCollisionPlane3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves SpringBoneCollision3D keys through the base-walk without re-declaring them', () => {
    // `rotation_offset` is the one that places the plane: its normal is the
    // rotated +Y axis (spring_bone_collision_plane_3d.cpp:36). Reaching it here
    // while it stays absent from getOwnKeys is what proves the base-walk, not a
    // silent copy of the ancestor's declaration.
    for (const key of ['bone', 'bone_name', 'position_offset', 'rotation_offset']) {
      expect(
        validatorRegistry.findValidator('SpringBoneCollisionPlane3D', key),
        `${key} must resolve through the SpringBoneCollision3D base-walk`
      ).not.toBeNull();
      expect(
        validatorRegistry.getOwnKeys('SpringBoneCollisionPlane3D'),
        `${key} belongs to SpringBoneCollision3D; re-declaring it here shadows the ancestor`
      ).not.toContain(key);
    }
  });

  it('rejects a malformed value on an inherited validator', () => {
    // The base-walk has to deliver the rule itself, not merely a non-null
    // function: a resolved validator that accepts anything is the same silent
    // gap as no validator at all.
    expect(check('rotation_offset', 'Quaternion(0, 0, 1)')).not.toBeNull();
    expect(check('position_offset', 'not-a-vector')).not.toBeNull();
    expect(check('bone_name', '&"Head"')).toBeNull();
  });
});
