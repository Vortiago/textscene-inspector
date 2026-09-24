/**
 * PhysicalBoneSimulator3D registers no validator, since Godot gives it no property. An empty
 * own-key set also looks like an unwritten slice, so the suite also asserts that the keys a real
 * scene carries still resolve to the ancestor's validators through the base-walk.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import { checkerFor } from '../../../../linter/testing/validatorCheck';
// For the fixture check alone: without Node3D, `transform` reaches no validator in a scoped run and
// `expectFixtureClean` skips the line the fixture's geometry claim rests on. `linterParser.ts`
// imports only its direct ancestor.
import '../../../base/node3d/linterParser';
import './linterParser';

/** `PhysicalBoneSimulator3D.<property>`'s registered validator, invoked at line 1. */
const check = checkerFor('PhysicalBoneSimulator3D');

/**
 * Set exactly one, from the source rather than from expectation: list the keys
 * PhysicalBoneSimulator3D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY. Both unset
 * is red on purpose. Do not delete an assertion to go green.
 */
const KEYS: string[] = [];
/**
 * True: `_bind_methods` (physical_bone_simulator_3d.cpp:386-393) binds five methods and no
 * `ADD_PROPERTY`, and no other route into a `.tscn` exists. `linterParser.ts` has the four-route
 * check.
 */
const DECLARES_NOTHING = true;

describe('PhysicalBoneSimulator3D strict validators', () => {
  it('registers exactly what PhysicalBoneSimulator3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('PhysicalBoneSimulator3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // Runs the fixture's "zero errors and zero warnings" claim against the validators this test
    // imports. `fixtureLint` checks the same file against the whole registry. With no own keys,
    // that is the inherited validators from SkeletonModifier3D up.
    expectFixtureClean('unit-physical-bone-simulator-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose validates no format. With no own keys this loop
    // checks an empty set, so the assertions below carry the weight.
    const accepted = validatorRegistry
      .getOwnKeys('PhysicalBoneSimulator3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('the inherited keys a scene writes on this node', () => {
    // scene/3d/skeleton_modifier_3d.cpp binds both. PhysicalBoneSimulator3D must not re-declare
    // them.
    it.each(['active', 'influence'])('resolves %s through the base-walk', (key) => {
      // Non-null says it resolves, and the empty own-key set says it resolved on an ancestor. A
      // shadowing re-declaration needs an own registration, so the pair rules one out.
      expect(validatorRegistry.findValidator('PhysicalBoneSimulator3D', key)).not.toBeNull();
      expect(validatorRegistry.getOwnKeys('PhysicalBoneSimulator3D')).not.toContain(key);
    });

    it('applies the ancestor bounds rather than accepting anything', () => {
      // skeleton_modifier_3d.cpp:161 hints influence as "0,1,0.001" over a bare
      // assignment, so out of range warns and a non-number is a format error.
      expect(check('influence', '0.75')).toBeNull();
      expect(check('influence', '2')?.severity).toBe('warning');
      expect(check('influence', 'most-of-it')?.severity).toBe('error');
    });
  });
});
