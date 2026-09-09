/**
 * FABRIK3D strict validators, which are none.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it.
 *
 * FABRIK3D binds no property of its own, so the interesting claim is not "this
 * bound is right" but "nothing is declared here, AND the inherited surface still
 * reaches this type". The second half is what an empty registration could
 * plausibly break, so it gets the tests.
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
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * FABRIK3D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = [];
/**
 * True: `fabr_ik_3d.h:35-40` is the entire class body and declares one member,
 * the `_solve_iteration` override, with no `_bind_methods` to hold an
 * `ADD_PROPERTY`. `fabr_ik_3d.cpp:33-87` is that override alone, so no
 * `_get_property_list` hand-rolls a `settings/<i>/` leaf either, and
 * `doc/classes/FABRIK3D.xml` has no `<members>` block.
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
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    //
    // With no own keys that is the INHERITED validators only — `linterParser`
    // imports the parent chain — so it covers what IterateIK3D up declares and
    // becomes this slice's own claim the moment KEYS gains an entry.
    expectFixtureClean('unit-fabrik-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; with no own keys it is vacuous today and
    // becomes real the moment one is added by mistake.
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
   * quietly lost `IterateIK3D` would make them pass against a shorter walk.
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
   * Sentinels in a PRIVATE registry, not the singleton.
   *
   * The real check one wants is `findValidator('FABRIK3D', 'max_iterations')`
   * against the shipped registrations, but `max_iterations` belongs to
   * IterateIK3D and `mutable_bone_axes` to IKModifier3D, so that assertion would
   * be a test in this slice whose green depends on another slice's content and
   * on when it lands. Registering sentinels under the ancestor keys instead runs
   * the SAME `findValidator` walk over the SAME generated table and proves the
   * property this slice is responsible for: FABRIK3D shadows nothing and adds no
   * hop of its own.
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
    // The half of the base-walk claim that IS this slice's to keep green: an
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
