/**
 * ModifierBoneTarget3D strict validators, asserted through `validatorRegistry`, not by linting a
 * `.tscn`, so a failure points at the validator and no fixture text needs upkeep. Rule-level
 * behaviour belongs in linter.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('ModifierBoneTarget3D', property);
  expect(validator, `no validator registered for ModifierBoneTarget3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Every key ModifierBoneTarget3D declares: two `ADD_PROPERTY` calls (modifier_bone_target_3d.cpp:96-97),
 * its whole serialised surface, with no `PropertyListHelper`, `register_property`, `ADD_ARRAY_COUNT`
 * or property-list override. `_validate_property` (:71) only edits the entries those two create.
 */
const KEYS: string[] = ['bone', 'bone_name'];
/** True only when the class binds no ADD_PROPERTY, beside the source line that proves it. */
const DECLARES_NOTHING = false;

describe('ModifierBoneTarget3D strict validators', () => {
  it('registers exactly what ModifierBoneTarget3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('ModifierBoneTarget3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run, not reasoned. `fixtureLint`
    // checks it against the whole registry through the barrel. This checks the same file
    // against only what this test imported.
    expectFixtureClean('unit-modifier-bone-target-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. This check is generic
    // on purpose, and per-property cases follow.
    const accepted = validatorRegistry
      .getOwnKeys('ModifierBoneTarget3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('bone_name', () => {
    it('accepts any quoted string, including the empty default', () => {
      // modifier_bone_target_3d.cpp:96 declares PROPERTY_HINT_ENUM_SUGGESTION
      // over the skeleton's bone names, which suggests rather than constrains,
      // and set_bone_name (:42-48) assigns whatever it is handed.
      expect(check('bone_name', '"Head"')).toBeNull();
      expect(check('bone_name', '""')).toBeNull();
      expect(check('bone_name', '"a bone no skeleton has"')).toBeNull();
    });

    it('rejects an unquoted value, which Godot never wrote', () => {
      expect(check('bone_name', 'Head')?.code).toBe('INVALID_BONE_NAME_FORMAT');
    });
  });

  describe('bone', () => {
    it('accepts -1, the unset sentinel the class defaults to', () => {
      // doc/classes/ModifierBoneTarget3D.xml declares default="-1", and
      // modifier_bone_target_3d.h:39 initialises `int bone = -1`. A floor of 0
      // would reject the value the class itself starts from.
      expect(check('bone', '-1')).toBeNull();
    });

    it('accepts any index at or above zero, the ceiling being the live bone count', () => {
      // set_bone's upper test is `bone >= sk->get_bone_count()`
      // (modifier_bone_target_3d.cpp:58): a quantity of the Skeleton3D this
      // node is parented to, which no per-property validator can see. There is
      // no static maximum, so none is asserted.
      expect(check('bone', '0')).toBeNull();
      expect(check('bone', '7')).toBeNull();
      expect(check('bone', '99999')).toBeNull();
    });

    it('errors below -1, where the setter rewrites the value', () => {
      // modifier_bone_target_3d.cpp:58-60. The WARN_PRINT on :59 is not the
      // grounds, since a warning alone would leave the value intact. The `bone = -1`
      // on :60 is: the write is altered, which ADR-0032 puts in the error tier.
      const error = check('bone', '-2');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_BONE_VALUE');
    });

    it('warns that a decimal is truncated rather than stored', () => {
      expect(check('bone', '2.5')?.code).toBe('INVALID_BONE_VALUE');
    });

    it('rejects a value that is not a number', () => {
      expect(check('bone', 'Head')?.code).toBe('INVALID_BONE_FORMAT');
    });
  });

  it('inherits SkeletonModifier3D keys through the base-walk without re-declaring them', () => {
    // This class strips `influence` to a bare PROPERTY_USAGE_READ_ONLY
    // (modifier_bone_target_3d.cpp:72-74), so Godot never writes it. That is no `registerUnavailable`
    // removal: set_influence (skeleton_modifier_3d.cpp:111) assigns, so a hand-written value is inert,
    // and it keeps the base's 0..1 bound.
    expect(validatorRegistry.findValidator('ModifierBoneTarget3D', 'influence')).not.toBeNull();
    expect(validatorRegistry.getOwnKeys('ModifierBoneTarget3D')).not.toContain('influence');
  });
});
