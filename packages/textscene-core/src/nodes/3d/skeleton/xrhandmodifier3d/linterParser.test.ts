/**
 * XRHandModifier3D strict validators: format and range checks. Asserted through
 * `validatorRegistry`, not by linting a `.tscn`, so a failure points at the validator and not at
 * scene parsing. linter.test.ts tests rule behaviour through `Linter`. Quote the governing Godot
 * source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('XRHandModifier3D', property);
  expect(validator, `no validator registered for XRHandModifier3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly one, from the source rather than from expectation: list the keys XRHandModifier3D
 * binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY. Both unset is red on purpose. Do
 * not delete an assertion to go green.
 */
const KEYS: string[] = ['bone_update', 'hand_tracker'];
/** True only when the class binds no ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

describe('XRHandModifier3D strict validators', () => {
  it('registers exactly what XRHandModifier3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('XRHandModifier3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // Runs the fixture's "zero errors and zero warnings" claim against the validators this test
    // imports. `fixtureLint` checks the same file against the whole registry.
    expectFixtureClean('unit-xr-hand-modifier-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose validates no format. This loop is generic, and the
    // per-property cases follow.
    const accepted = validatorRegistry
      .getOwnKeys('XRHandModifier3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('bone_update', () => {
    it('accepts the first legal value, BONE_UPDATE_FULL', () => {
      expect(check('bone_update', '0')).toBeNull();
    });

    it('accepts the last legal value, BONE_UPDATE_ROTATION_ONLY', () => {
      expect(check('bone_update', '1')).toBeNull();
    });

    it('errors on BONE_UPDATE_MAX, the first illegal value', () => {
      // xr_hand_modifier_3d.cpp:64 `ERR_FAIL_INDEX(p_bone_update, BONE_UPDATE_MAX)`
      // is `>= size`, so the size marker itself (2) never reaches the assignment
      // on :65. A refused write is an error, not a hint warning (ADR-0032).
      const error = check('bone_update', '2');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('bone_update');
    });

    it('errors on a negative value, the other half of the ERR_FAIL_INDEX', () => {
      const error = check('bone_update', '-1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });

    it('rejects a non-numeric value', () => {
      expect(check('bone_update', 'Rotation Only')).not.toBeNull();
    });
  });

  describe('hand_tracker', () => {
    it('accepts the default as the StringName form Godot writes', () => {
      // The ADD_PROPERTY at :43 declares Variant::STRING, but get_hand_tracker
      // (:59) returns StringName, and the getter decides the serialised form:
      // the XML default is &"/user/hand_tracker/left".
      expect(check('hand_tracker', '&"/user/hand_tracker/left"')).toBeNull();
    });

    it('accepts the same value as a plain quoted string', () => {
      expect(check('hand_tracker', '"/user/hand_tracker/left"')).toBeNull();
    });

    it('accepts a name outside the suggestion list', () => {
      // PROPERTY_HINT_ENUM_SUGGESTION (:43) "still accepts arbitrary values and
      // can be empty" (@GlobalScope.xml:2786) and set_hand_tracker (:51-57) is a
      // bare assignment, so membership is not a bound at all: no error, no warning.
      expect(check('hand_tracker', '&"/user/hand_tracker/third"')).toBeNull();
      expect(check('hand_tracker', '&""')).toBeNull();
    });

    it('rejects an unquoted value', () => {
      const error = check('hand_tracker', '/user/hand_tracker/left');
      expect(error).not.toBeNull();
      expect(error?.message).toContain('hand_tracker');
    });

    it('rejects a value missing its opening quote', () => {
      expect(check('hand_tracker', '/user/hand_tracker/left"')).not.toBeNull();
    });
  });

  describe('inherited keys', () => {
    it('resolves influence through the base walk without re-declaring it', () => {
      // SkeletonModifier3D owns `influence`; re-declaring it here would shadow
      // the ancestor's bound and duplicate the rule.
      expect(validatorRegistry.findValidator('XRHandModifier3D', 'influence')).not.toBeNull();
      expect(validatorRegistry.getOwnKeys('XRHandModifier3D')).not.toContain('influence');
    });

    it('resolves active the same way', () => {
      expect(validatorRegistry.findValidator('XRHandModifier3D', 'active')).not.toBeNull();
      expect(validatorRegistry.getOwnKeys('XRHandModifier3D')).not.toContain('active');
    });
  });
});
