/**
 * FABRIK3D strict validators, which are none, asserted through `validatorRegistry`, not by linting a
 * `.tscn`. The claim is that nothing is declared here and the inherited keys still reach this type,
 * and the second half is what an empty registration could break.
 */

import { describe, expect, it } from 'vitest';
import { ValidatorRegistry, validatorRegistry } from '../../../../linter/ValidatorRegistry';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry';
import { NODE_BASE_TYPES, baseChain } from '../../../../godot/nodeBaseTypes';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import { checkerFor } from '../../../../linter/testing/validatorCheck';
import './linterParser';

/** `FABRIK3D.<property>`'s registered validator, invoked at line 1. */
const check = checkerFor('FABRIK3D');

/**
 * The keys FABRIK3D binds, read from the source. Set this or DECLARES_NOTHING, not both.
 * Leaving both unset is red on purpose: do not delete an assertion to go green.
 */
const KEYS: string[] = [];
/**
 * True: `fabr_ik_3d.h:35-40` is the whole class body, one `_solve_iteration` override and no
 * `_bind_methods`. `fabr_ik_3d.cpp:33-87` is that override alone, so no `_get_property_list` builds a
 * `settings/<i>/` leaf, and `doc/classes/FABRIK3D.xml` has no `<members>` block.
 */
const DECLARES_NOTHING = true;

describe('FABRIK3D strict validators', () => {
  it('registers exactly what FABRIK3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('FABRIK3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run, not reasoned, against only what this
    // test imported. With no own keys, that is the validators IterateIK3D and up declare, and it
    // becomes this slice's own claim once KEYS gains an entry.
    expectFixtureClean('unit-fabrik-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. This check is generic on
    // purpose. With no own keys it is vacuous, and it catches an own key added by mistake.
    const accepted = validatorRegistry
      .getOwnKeys('FABRIK3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });
});

describe('FABRIK3D inherits its whole property surface', () => {
  /**
   * The generated ancestry, asserted before anything is read through it: every
   * test below is a claim about hops in this exact chain, and a table that had
   * lost `IterateIK3D` would make them pass against a shorter walk.
   */
  it('sits at the bottom of the IK chain Godot declares', () => {
    expect(baseChain('FABRIK3D')).toEqual([
      'IterateIK3D',
      'ChainIK3D',
      'IKModifier3D',
      'SkeletonModifier3D',
      'Node3D',
      'Node',
    ]);
  });

  /**
   * Sentinels in a private registry, not the singleton. `max_iterations` is IterateIK3D's and
   * `mutable_bone_axes` IKModifier3D's, so checking the shipped registrations would make this test
   * depend on other slices. Sentinels under the ancestor keys run the same `findValidator` walk over
   * the same table and prove this slice's claim: FABRIK3D shadows nothing and adds no hop.
   */
  function registryWithAncestorSentinels() {
    const registry = new ValidatorRegistry(NODE_BASE_TYPES);
    const iterateIK: PropertyValidator = () => null;
    const ikModifier: PropertyValidator = () => null;
    const node3D: PropertyValidator = () => null;
    registry.registerAll('IterateIK3D', { max_iterations: iterateIK });
    registry.registerAll('IKModifier3D', { mutable_bone_axes: ikModifier });
    registry.registerAll('Node3D', { transform: node3D });
    return { registry, iterateIK, ikModifier, node3D };
  }

  it("resolves IterateIK3D's max_iterations one hop up", () => {
    const { registry, iterateIK } = registryWithAncestorSentinels();
    expect(registry.findValidator('FABRIK3D', 'max_iterations')).toBe(iterateIK);
  });

  it("resolves IKModifier3D's mutable_bone_axes across the ChainIK3D hop", () => {
    const { registry, ikModifier } = registryWithAncestorSentinels();
    expect(registry.findValidator('FABRIK3D', 'mutable_bone_axes')).toBe(ikModifier);
  });

  it('resolves the Node3D keys its own fixture carries', () => {
    const { registry, node3D } = registryWithAncestorSentinels();
    expect(registry.findValidator('FABRIK3D', 'transform')).toBe(node3D);
  });

  it('re-declares none of the inherited keys, so no ancestor validator is shadowed', () => {
    // The half of the base-walk claim that is this slice's to keep green: an
    // own key with either name would win the lookup at hop zero and silently
    // replace the ancestor's bound, including its radians_as_degrees handling.
    const own = validatorRegistry.getOwnKeys('FABRIK3D');
    expect(own).toEqual([]);
    for (const inherited of ['max_iterations', 'min_distance', 'angular_delta_limit',
      'deterministic', 'setting_count', 'mutable_bone_axes', 'transform']) {
      expect(own, `${inherited} belongs to an ancestor`).not.toContain(inherited);
    }
  });
});
