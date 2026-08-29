/**
 * CCDIK3D strict validators: it has none, and these pin that down rather than
 * treat it as work not yet done.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing. There is no `linter.ts` beside this file and no
 * rule test, because a cross-field rule needs two fields and CCDIK3D adds none.
 *
 * The ancestor imports below are load-bearing, not tidiness. A slice test sees
 * only the registrations it pulled in itself, so a base-walk case that names an
 * ancestor's key has to import that ancestor by name or it observes a null it
 * would have observed with the walk broken.
 *
 * `./linterParser` reaches IterateIK3D, and since the tier chain was stitched
 * mid-wave it now transitively reaches ChainIK3D and IKModifier3D too, so two
 * of the three explicit imports are redundant today. They stay: the stitching
 * is one line per file that did not exist when this slice was written, and
 * relying on it would make this test's coverage contingent on someone else's
 * slice with nothing going red if the line were dropped. Nothing here affects
 * the shipped bundle either way, since every module involved is a linterParser
 * with no Component import.
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
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * CCDIK3D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = [];
/**
 * True: CCDIK3D binds nothing. `ccd_ik_3d.h:35-40` is the entire class body,
 * `GDCLASS` plus one `_solve_iteration` override whose definition
 * (`ccd_ik_3d.cpp:33`) is the entire `.cpp`. No `_bind_methods`, so no
 * `ADD_PROPERTY` or `ADD_ARRAY_COUNT`; no `_get_property_list` and no
 * unprefixed `get_property_list` either, so no hand-rolled `settings/` leaf.
 */
const DECLARES_NOTHING = true;

/**
 * Ancestor keys CCDIK3D must inherit rather than restate, with their owners.
 *
 * CCDIK3D owes two things on each: that it shadows neither with a copy of its
 * own, and that the walk hands back the owner's own function rather than a
 * lookalike. Asserting non-null as well is what keeps the identity comparison
 * from passing as a matching pair of nulls the day an owner stops registering.
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
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    //
    // With no own keys that is the INHERITED validators only — `linterParser`
    // imports the parent chain — so it covers what IterateIK3D up declares and
    // becomes this slice's own claim the moment KEYS gains an entry.
    expectFixtureClean('unit-ccdik-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // Empty by construction while CCDIK3D owns no key, and kept for the day it
    // does: a validator that accepts arbitrary prose is not validating a format.
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
    // A Transform3D needs twelve components; three is not a parse Godot makes.
    expect(check('transform', 'Transform3D(1, 2, 3)')).not.toBeNull();
  });

  it('invents no validator for a key nothing in the chain declares', () => {
    // The base-walk widens what a type accepts, so the failure mode worth
    // guarding is it answering for a key no ancestor ever bound.
    expect(validatorRegistry.findValidator('CCDIK3D', 'ccdik_joint_count')).toBeNull();
  });
});
