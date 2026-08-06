/**
 * PhysicalBoneSimulator3D registers no validator, because Godot gives it no
 * property to validate.
 *
 * The interesting assertions here are therefore about ABSENCE, and absence is
 * cheap to assert by accident: an empty own-key set is also what a slice that
 * never got written looks like. So the suite pins the absence at both ends. It
 * asserts the own-key set is empty, and it asserts that the keys a real scene
 * DOES carry on this node still resolve, through the base-walk, to the
 * ancestor's validators. A regression that dropped the base-walk, or one that
 * re-declared an inherited key here, breaks the second half while the first
 * half stays green.
 *
 * Node3D's registrations are imported for the fixture check alone. Without them
 * `transform` reaches no validator in a scoped run and `expectFixtureClean`
 * would pass without reading the only line the fixture's geometry claim rests
 * on. `linterParser.ts` itself imports only its direct ancestor.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import '../../../base/node3d/linterParser';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('PhysicalBoneSimulator3D', property);
  expect(validator, `no validator registered for PhysicalBoneSimulator3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * PhysicalBoneSimulator3D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = [];
/**
 * True: `_bind_methods` (physical_bone_simulator_3d.cpp:386-393) binds five
 * methods and zero `ADD_PROPERTY`, and no other route into a `.tscn` is taken
 * either. See `linterParser.ts` for the full four-route check and the measured
 * storage-list comparison against SkeletonModifier3D.
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
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-physical-bone-simulator-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. With
    // no own keys this sweeps an empty set, which is the correct outcome and
    // evidence of nothing; the assertions below carry the weight instead.
    const accepted = validatorRegistry
      .getOwnKeys('PhysicalBoneSimulator3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('the inherited keys a scene writes on this node', () => {
    // scene/3d/skeleton_modifier_3d.cpp binds both; PhysicalBoneSimulator3D
    // adds nothing to them and must not re-declare them.
    it.each(['active', 'influence'])('resolves %s through the base-walk', (key) => {
      // Non-null says it resolves; the empty own-key set says it resolved on an
      // ANCESTOR. A shadowing re-declaration would need an own registration, so
      // the pair rules one out without reaching into how the walk resolves.
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
