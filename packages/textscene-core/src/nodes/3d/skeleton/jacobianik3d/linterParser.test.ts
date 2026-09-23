/**
 * JacobianIK3D strict validators: none, by finding (`jacobian_ik_3d.h:35-40`, no `_bind_methods`, no
 * property-list override, no `<members>` in `doc/classes/JacobianIK3D.xml`). An empty slice and one
 * that shadows its base look alike from outside, so these pin that it owns no key and that its
 * ancestry is walkable. Asserted through `validatorRegistry`, never `Linter`, which pulls the barrel.
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

// A slice test sees only the registrations it imports, so each base-walk case names an ancestor
// imported here, or it passes vacuously on a null. `./linterParser` reaches the first three
// transitively, and they stay so a dropped line in another slice cannot cut this coverage. The chain
// dead-ends at `skeletonmodifier3d/linterParser.ts`, so the `node3d` import is needed outright.
import '../chainik3d/linterParser';
import '../shared/linterParser';
import '../skeletonmodifier3d/linterParser';
import '../../../base/node3d/linterParser';
import { registeredTypes } from '../../../../linter/registryPopulation.js';

/** `JacobianIK3D.<property>`'s registered validator, invoked at line 1. */
const check = checkerFor('JacobianIK3D');

/**
 * JacobianIK3D binds no `ADD_PROPERTY`, so KEYS is empty. `jacobian_ik_3d.h:35-40` is the whole class
 * body with one method, its only definition is `jacobian_ik_3d.cpp:33`, and
 * `scene/register_scene_types.cpp:686` registers it.
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

/** A stand-in validator, matched by identity so no equivalent one can pass for it. */
const probe: PropertyValidator = () => null;

/**
 * A registry on the real ancestry table, seeded by hand with `probe`. On the singleton, a lookup
 * through an ancestor slice that declares nothing resolves to null and passes vacuously. A private
 * registry seeded with `NODE_BASE_TYPES` tests that the ancestry is walkable from here, with the real
 * key names and hops, independent of sibling slices.
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
    // The fixture's "zero errors and zero warnings" claim, run, not reasoned, against only what this
    // test imported. With no own keys, that is the validators IterateIK3D and up declare, and it
    // becomes this slice's own claim once KEYS gains an entry.
    expectFixtureClean('unit-jacobian-ik-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format.
    // Empty here, and kept: it checks any own key declared later.
    const accepted = validatorRegistry
      .getOwnKeys('JacobianIK3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });
});

describe('JacobianIK3D inherited validators', () => {
  it('reaches every tier that declares a key for it', () => {
    // JacobianIK3D < IterateIK3D < ChainIK3D < IKModifier3D < SkeletonModifier3D. A missing hop
    // drops a whole tier's validators in silence. The nearest hop is pinned exactly, the rest by
    // membership. The ancestry table is
    // GENERATED from the node catalog, and `baseChainCompleteness` already owns
    // the whole-table claim.
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
    // Both sides are the ancestor's real validator, since the tiers above are imported: the live
    // counterpart of the seeded probes. The key resolves to the same function the base does, which
    // rules out this slice answering with bounds the ancestor never derived.
    for (const key of Object.keys(INHERITED)) {
      const resolved = validatorRegistry.findValidator('JacobianIK3D', key);
      expect(resolved, `${key} resolves to nothing on JacobianIK3D`).not.toBeNull();
      expect(validatorRegistry.getOwnKeys('JacobianIK3D')).not.toContain(key);
      expect(resolved).toBe(validatorRegistry.findValidator('IterateIK3D', key));
    }
  });

  it('leaves no fixture key silently unchecked', () => {
    // What stops the fixture being decorative: `StrictTscnParser` skips a property no validator
    // matches (`if (!validator) return;`), so a file of inherited keys lints clean when nothing is
    // registered. Asserting each resolves makes the clean result evidence that the base-walk delivers.
    const section = readFixture('unit-jacobian-ik-3d.tscn').split('type="JacobianIK3D"')[1] ?? '';
    const keys = [...section.matchAll(/^([\w/]+) = /gm)].map((m) => m[1]!);

    // A floor, so a regex that stops matching cannot pass by finding nothing.
    expect(keys.length).toBeGreaterThan(8);
    const unchecked = keys.filter((key) => !validatorRegistry.findValidator('JacobianIK3D', key));
    expect(unchecked).toEqual([]);
  });
});
