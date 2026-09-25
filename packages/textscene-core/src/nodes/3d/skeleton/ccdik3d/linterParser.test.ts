/**
 * CCDIK3D strict validators: it has none, and these tests pin that. It adds no field, so no rule
 * exists to test. A slice test sees only the registrations it imports, so each base-walk case imports
 * the ancestor it names, even where `./linterParser` reaches it transitively: a dropped line in
 * another slice must not cut this test's coverage in silence.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import { checkerFor } from '../../../../linter/testing/validatorCheck';
import './linterParser';
import '../shared/linterParser';
import '../skeletonmodifier3d/linterParser';
import '../../../base/node3d/linterParser';

/** `CCDIK3D.<property>`'s registered validator, invoked at line 1. */
const check = checkerFor('CCDIK3D');

/**
 * The keys CCDIK3D binds, read from the source. Set this or DECLARES_NOTHING, not both.
 * Leaving both unset is red on purpose: do not delete an assertion to go green.
 */
const KEYS: string[] = [];
/**
 * True: CCDIK3D binds nothing. `ccd_ik_3d.h:35-40` is the whole class body, `GDCLASS` plus one
 * `_solve_iteration` override, defined at `ccd_ik_3d.cpp:33`. It has no `_bind_methods`, and no
 * `_get_property_list` or unprefixed `get_property_list`, so no key reaches a scene by any route.
 */
const DECLARES_NOTHING = true;

/**
 * Ancestor keys CCDIK3D must inherit rather than restate, with their owners. CCDIK3D must not shadow
 * either, and the walk must return the owner's own function. The non-null assertion stops the
 * identity check passing as two nulls if an owner stops registering.
 */
const INHERITED: ReadonlyArray<readonly [owner: string, key: string]> = [
  // iterate_ik_3d.cpp:394, one hop up.
  ['IterateIK3D', 'max_iterations'],
  // ik_modifier_3d.cpp:64, three hops up.
  ['IKModifier3D', 'mutable_bone_axes'],
];

describe('CCDIK3D strict validators', () => {
  it('registers exactly what CCDIK3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('CCDIK3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run, not reasoned, against only what this
    // test imported. With no own keys, that is the validators IterateIK3D and up declare, and it
    // becomes this slice's own claim once KEYS gains an entry.
    expectFixtureClean('unit-ccdik-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // Empty while CCDIK3D owns no key, and kept for when it does: a validator that accepts
    // arbitrary prose is not validating a format.
    const accepted = validatorRegistry
      .getOwnKeys('CCDIK3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('reaches IterateIK3D and IKModifier3D without re-declaring either key', () => {
    for (const [owner, key] of INHERITED) {
      expect(validatorRegistry.getOwnKeys('CCDIK3D')).not.toContain(key);
      const inherited = validatorRegistry.findValidator('CCDIK3D', key);
      expect(inherited, `${key} did not resolve on CCDIK3D`).not.toBeNull();
      expect(inherited).toBe(validatorRegistry.findValidator(owner, key));
    }
  });

  it('walks four hops to SkeletonModifier3D and five to Node3D', () => {
    // The chain is CCDIK3D, IterateIK3D, ChainIK3D, IKModifier3D,
    // SkeletonModifier3D, Node3D. Both ancestors named here already register
    // real validators, so a broken walk shows up as a null rather than as a
    // matching pair of nulls.
    const influence = validatorRegistry.findValidator('CCDIK3D', 'influence');
    expect(influence).not.toBeNull();
    expect(influence).toBe(validatorRegistry.findValidator('SkeletonModifier3D', 'influence'));

    const transform = validatorRegistry.findValidator('CCDIK3D', 'transform');
    expect(transform).not.toBeNull();
    expect(transform).toBe(validatorRegistry.findValidator('Node3D', 'transform'));
  });

  it('still rejects through the walk, so inheriting a key is not accepting anything', () => {
    // skeleton_modifier_3d.cpp:161 hints influence to "0,1,0.001", so 1.5 is
    // outside the inspector's own control and draws a diagnostic.
    expect(check('influence', '1.5')).not.toBeNull();
    // A Transform3D needs twelve components, so three is not a parse Godot makes.
    expect(check('transform', 'Transform3D(1, 2, 3)')).not.toBeNull();
  });

  it('invents no validator for a key nothing in the chain declares', () => {
    // The base-walk widens what a type accepts, so the failure mode worth
    // guarding is it answering for a key no ancestor ever bound.
    expect(validatorRegistry.findValidator('CCDIK3D', 'ccdik_joint_count')).toBeNull();
  });
});
