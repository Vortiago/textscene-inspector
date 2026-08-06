/**
 * SpringBoneCollisionPlane3D strict validators: coverage and base-walk checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * The class binds nothing of its own (see linterParser.ts for the four-route
 * proof), so there is no per-property happy/malformed/bound case to grow here.
 * What has to hold instead is that the base-walk still reaches every inherited
 * key a scene author can legally set on a plane, and that none of them was
 * quietly re-declared on this type, which would shadow the ancestor.
 *
 * The walk is asserted only as far as SpringBoneCollision3D. Node3D's keys,
 * `transform` among them, resolve in the app because `linter/index.ts` loads
 * every slice, but not from this file's import graph: the ancestor-import chain
 * that Control keeps up to CanvasItem stops at SpringBoneCollision3D, which
 * imports no ancestor. So `expectFixtureClean` below leaves the fixture's
 * `transform` line unchecked, and `fixtureLint` stays the gate that sees it.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('SpringBoneCollisionPlane3D', property);
  expect(validator, `no validator registered for SpringBoneCollisionPlane3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * SpringBoneCollisionPlane3D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = [];
/**
 * True: the class binds no property by any of the four routes. The whole
 * translation unit is scene/3d/spring_bone_collision_plane_3d.cpp:31-43, an
 * include plus the `_collide` override, with no `_bind_methods` and no
 * `.compat.inc`; scene/3d/spring_bone_collision_plane_3d.h:38-39 declares only
 * that override; doc/classes/SpringBoneCollisionPlane3D.xml has no `<members>`.
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
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
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
