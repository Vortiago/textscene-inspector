/**
 * JacobianIK3D strict validators.
 *
 * The slice declares none, and that is the finding rather than an omission:
 * `jacobian_ik_3d.h:35-40` is the whole class, one protected `_solve_iteration`
 * override with no `_bind_methods` to hold an `ADD_PROPERTY`, no
 * `_get_property_list` / `get_property_list` override to add a `settings/<i>/`
 * leaf, and no `<members>` block in `doc/classes/JacobianIK3D.xml`.
 *
 * So the assertions worth making here are about the ABSENCE. A slice that
 * declares nothing and a slice that quietly shadows its base read identically
 * from the outside, and only the second one breaks the linter: it answers for
 * an inherited key with a validator that knows none of the ancestor's bounds.
 * These pin that JacobianIK3D owns no key, and that the ancestry the real keys
 * arrive along is walkable from here.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`, so a
 * failure points at the registration instead of at scene parsing, and never
 * through `Linter`, which would pull the barrel and every in-flight sibling.
 */

import { describe, expect, it } from 'vitest';
import {
  ValidatorRegistry,
  validatorRegistry,
  type PropertyValidator,
} from '../../../../linter/ValidatorRegistry';
import { NODE_BASE_TYPES, baseChain } from '../../../../godot/nodeBaseTypes';
import { expectFixtureClean, readFixture } from '../../../../linter/testing/fixtureCheck';
import { checkerFor } from '../../../../linter/testing/validatorCheck';
import './linterParser';

// A slice test sees only the registrations it pulled in itself, so every
// base-walk case below names an ancestor it imports here: otherwise it observes
// a null it would also have observed with the walk broken, and passes vacuously.
//
// `./linterParser` now reaches four of the six tiers on its own, because the
// chain got stitched mid-wave (iterateik3d -> chainik3d -> shared ->
// skeletonmodifier3d). The first three imports below are therefore redundant
// TODAY and are kept anyway: that stitching is one line per file, it did not
// exist when this slice was written, and dropping these would make this test's
// coverage contingent on an edge in someone else's slice with nothing going red
// if it were removed. The `node3d` import is not redundant at all, since
// `skeletonmodifier3d/linterParser.ts` imports no tier and the chain dead-ends
// there.
import '../chainik3d/linterParser';
import '../shared/linterParser';
import '../skeletonmodifier3d/linterParser';
import '../../../base/node3d/linterParser';
import { registeredTypes } from '../../../../linter/registryPopulation.js';

/** `JacobianIK3D.<property>`'s registered validator, invoked at line 1. */
const check = checkerFor('JacobianIK3D');

/**
 * JacobianIK3D binds no `ADD_PROPERTY` anywhere, so KEYS is empty by fact.
 *
 * The proof is the header: `jacobian_ik_3d.h:35-40` is the entire class body and
 * declares one method, which leaves nowhere for a `_bind_methods` to be. Its
 * only definition is `jacobian_ik_3d.cpp:33`, and
 * `scene/register_scene_types.cpp:686` registering the class is the extent of
 * what the engine says about it.
 */
const KEYS: string[] = [];
const DECLARES_NOTHING = true;

/**
 * Keys JacobianIK3D carries in a scene but does not declare, each with the tier
 * that binds it. Two hops apart on purpose: one from the immediate base and one
 * from three tiers up, so a base-walk that stops after the first hop fails.
 */
const INHERITED: Readonly<Record<string, string>> = {
  max_iterations: 'IterateIK3D', // iterate_ik_3d.cpp:394
  mutable_bone_axes: 'IKModifier3D', // ik_modifier_3d.cpp:64
};

/** A stand-in validator, matched by IDENTITY so no equivalent one can pass for it. */
const probe: PropertyValidator = () => null;

/**
 * A registry on the REAL ancestry table, seeded by hand with `probe`.
 *
 * The live singleton cannot carry this check: IterateIK3D and IKModifier3D are
 * separate slices, so until each declares its own validators a lookup through
 * them resolves to null and any assertion on it passes vacuously. What is
 * JacobianIK3D's business is whether its ancestry is WALKABLE from here, and
 * seeding a private registry with `NODE_BASE_TYPES` tests exactly that, using
 * the real key names and the real hops, without depending on when a sibling
 * slice lands.
 */
function seededChain(): ValidatorRegistry {
  const registry = new ValidatorRegistry(NODE_BASE_TYPES);
  for (const [key, owner] of Object.entries(INHERITED)) {
    registry.registerAll(owner, { [key]: probe });
  }
  return registry;
}

describe('JacobianIK3D strict validators', () => {
  it('registers exactly what JacobianIK3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('JacobianIK3D').sort()).toEqual([...KEYS].sort());
  });

  it('is registered rather than merely absent from the registry', () => {
    // `getOwnKeys` returns [] both for a type that declares nothing and for one
    // no slice ever registered, so the empty result above proves nothing on its
    // own. This is what separates the two.
    expect(registeredTypes('declaring')).toContain('JacobianIK3D');
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
    expectFixtureClean('unit-jacobian-ik-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format.
    // Empty here, and deliberately kept: it is what turns any future own-key
    // declaration into a checked one the day it appears.
    const accepted = validatorRegistry
      .getOwnKeys('JacobianIK3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });
});

describe('JacobianIK3D inherited validators', () => {
  it('reaches every tier that declares a key for it', () => {
    // JacobianIK3D < IterateIK3D < ChainIK3D < IKModifier3D < SkeletonModifier3D.
    // A missing hop silently drops a whole tier's validators, and nothing in
    // this slice would look any different for it.
    //
    // The nearest hop is pinned exactly, the rest by membership: the table is
    // GENERATED from the node catalog, and `baseChainCompleteness` already owns
    // the whole-table claim, so re-asserting the tail here would only couple
    // this slice to a regeneration that has nothing to do with JacobianIK3D.
    expect(baseChain('JacobianIK3D')[0]).toBe('IterateIK3D');
    for (const tier of ['ChainIK3D', 'IKModifier3D', 'SkeletonModifier3D', 'Node3D']) {
      expect(baseChain('JacobianIK3D')).toContain(tier);
    }
  });

  it("resolves IterateIK3D's max_iterations one hop up", () => {
    expect(seededChain().findValidator('JacobianIK3D', 'max_iterations')).toBe(probe);
  });

  it("resolves IKModifier3D's mutable_bone_axes three hops up", () => {
    expect(seededChain().findValidator('JacobianIK3D', 'mutable_bone_axes')).toBe(probe);
  });

  it('shadows neither key, so the live registry can only answer upward', () => {
    // Both sides are the ancestor's real validator now that the tiers above are
    // imported, so this is the live counterpart of the seeded probes: the key
    // resolves, and it resolves to the SAME function the base does, which is
    // what rules out this slice answering with bounds the ancestor never derived.
    for (const key of Object.keys(INHERITED)) {
      const resolved = validatorRegistry.findValidator('JacobianIK3D', key);
      expect(resolved, `${key} resolves to nothing on JacobianIK3D`).not.toBeNull();
      expect(validatorRegistry.getOwnKeys('JacobianIK3D')).not.toContain(key);
      expect(resolved).toBe(validatorRegistry.findValidator('IterateIK3D', key));
    }
  });

  it('leaves no fixture key silently unchecked', () => {
    // What stops the fixture being decorative. `StrictTscnParser` skips a
    // property no validator matches (`if (!validator) return;`), so a file full
    // of inherited keys can lint clean precisely BECAUSE nothing is registered
    // for them. Asserting each one resolves is what turns the clean result above
    // into evidence that the five-deep base-walk delivers.
    const section = readFixture('unit-jacobian-ik-3d.tscn').split('type="JacobianIK3D"')[1] ?? '';
    const keys = [...section.matchAll(/^([\w/]+) = /gm)].map((m) => m[1]!);

    // A floor, so a regex that stops matching cannot pass by finding nothing.
    expect(keys.length).toBeGreaterThan(8);
    const unchecked = keys.filter((key) => !validatorRegistry.findValidator('JacobianIK3D', key));
    expect(unchecked).toEqual([]);
  });
});
