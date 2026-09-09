/**
 * SpringBoneCollisionSphere3D strict validators: format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * The class binds exactly two properties (spring_bone_collision_sphere_3d.cpp:61-62)
 * and every numeric bound below quotes the governing Godot source line.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.declarationFor('SpringBoneCollisionSphere3D', property);
  expect(validator, `no validator registered for SpringBoneCollisionSphere3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * SpringBoneCollisionSphere3D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = ['radius', 'inside'];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

describe('SpringBoneCollisionSphere3D strict validators', () => {
  it('registers exactly what SpringBoneCollisionSphere3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('SpringBoneCollisionSphere3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-spring-bone-collision-sphere-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('SpringBoneCollisionSphere3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });
});

describe('SpringBoneCollisionSphere3D.radius', () => {
  it('accepts the engine default and other in-hint radii', () => {
    // spring_bone_collision_sphere_3d.h:42 defaults `radius = 0.1`.
    expect(check('radius', '0.1')).toBeNull();
    expect(check('radius', '0.25')).toBeNull();
    expect(check('radius', '0')).toBeNull();
  });

  it('accepts a radius past the hint ceiling, because `or_greater` opens it', () => {
    // spring_bone_collision_sphere_3d.cpp:61 hints "0,1,0.001,or_greater,suffix:m".
    // The 1 is where the inspector slider stops, not a ceiling: `or_greater`
    // lets the spinner type any larger value, so 5 is an ordinary radius.
    expect(check('radius', '5.0')).toBeNull();
    expect(check('radius', '1000')).toBeNull();
  });

  it('accepts inf, which Godot writes and reloads as a float literal', () => {
    // variant_parser.cpp:150-155. set_radius has no `is_finite` guard, so an
    // infinite radius round-trips; only a real ERR_FAIL_COND would refuse it.
    expect(check('radius', 'inf')).toBeNull();
    expect(check('radius', 'nan')).toBeNull();
  });

  it('warns rather than errors below the hinted floor', () => {
    // set_radius (spring_bone_collision_sphere_3d.cpp:33-38) is a bare
    // assignment plus a TOOLS_ENABLED gizmo refresh: no clamp, no ERR_FAIL, so
    // a negative radius is stored verbatim and only the hint's 0 objects to it.
    // ADR-0032 makes that a WARNING; asserting merely "not null" would also
    // pass a wrongly-`enforced` bound.
    const diagnostic = check('radius', '-0.5');
    expect(diagnostic).not.toBeNull();
    expect(diagnostic!.severity).toBe('warning');
  });

  it('keeps a malformed radius an error whatever the bound is grounded in', () => {
    const diagnostic = check('radius', 'wide');
    expect(diagnostic).not.toBeNull();
    expect(diagnostic!.severity).toBe('error');
  });

  it('grounds the floor in the hint, not in the setter', () => {
    const validator = validatorRegistry.declarationFor('SpringBoneCollisionSphere3D', 'radius');
    expect(validator!.grounding).toEqual({
      kind: 'hinted',
      cite: 'spring_bone_collision_sphere_3d.cpp:61',
    });
  });
});

describe('SpringBoneCollisionSphere3D.inside', () => {
  it('accepts both booleans', () => {
    // spring_bone_collision_sphere_3d.cpp:62 binds it with no hint argument at
    // all, and set_inside (:44-49) assigns straight through, so the only thing
    // to check is the literal's form.
    expect(check('inside', 'true')).toBeNull();
    expect(check('inside', 'false')).toBeNull();
  });

  it('rejects a non-boolean literal', () => {
    expect(check('inside', '1')).not.toBeNull();
  });

  it('constrains no value, only the format', () => {
    const validator = validatorRegistry.declarationFor('SpringBoneCollisionSphere3D', 'inside');
    expect(validator!.formatOnly).toBe(true);
    expect(validator!.grounding).toBeUndefined();
  });

  it('leaves what a legal radius is untouched', () => {
    // `inside` flips the sign of the collision test in _collide_sphere
    // (spring_bone_collision_sphere_3d.cpp:65-74), but the bone radius it
    // subtracts against comes from SpringBoneSimulator3D, not from this node,
    // so there is no cross-field bound to check here.
    expect(check('radius', '0.001')).toBeNull();
  });
});

describe('SpringBoneCollisionSphere3D inherited validators', () => {
  it('resolves a SpringBoneCollision3D key through the base walk instead of re-declaring it', () => {
    // Re-declaring `bone_name` here would shadow the ancestor and duplicate the
    // rule, so the slice must NOT own it and must still validate it.
    expect(validatorRegistry.getOwnKeys('SpringBoneCollisionSphere3D')).not.toContain('bone_name');
    expect(validatorRegistry.findValidator('SpringBoneCollisionSphere3D', 'bone_name')).not.toBeNull();
    expect(check('bone_name', '&"Head"')).toBeNull();
  });
});
