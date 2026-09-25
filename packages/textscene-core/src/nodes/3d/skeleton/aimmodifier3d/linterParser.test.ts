/**
 * AimModifier3D strict validators, asserted through `validatorRegistry`, not by linting a `.tscn`,
 * so a failure points at the validator and no fixture text needs upkeep. Rule-level behaviour
 * belongs in linter.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import { BONE_CONSTRAINT_SETTING_LEAVES } from '../boneconstraint3d/linterParser';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('AimModifier3D', property);
  expect(validator, `no validator registered for AimModifier3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Every key AimModifier3D declares, read from the source. `setting_count` is the ADD_ARRAY_COUNT at
 * aim_modifier_3d.cpp:190, the one member doc/classes/AimModifier3D.xml lists. `settings/#/*` is the
 * indexed family `_get_property_list` builds (aim_modifier_3d.cpp:84-97), in no ADD_PROPERTY call.
 */
const KEYS: string[] = ['setting_count', 'settings/#/*'];
/** True only when the class binds no ADD_PROPERTY, beside the source line that proves it. */
const DECLARES_NOTHING = false;

/**
 * The leaves BoneConstraint3D adds to the same `settings/<i>/` family (bone_constraint_3d.cpp:102-108).
 * `_get_property_list` calls `BoneConstraint3D::get_property_list` first (aim_modifier_3d.cpp:85),
 * so a real node carries these keys and the dispatcher must not report them as unknown.
 */
const BASE_LEAF_KEYS: Readonly<Record<string, string>> = {
  amount: '0.5',
  apply_bone_name: '"Head"',
  apply_bone: '3',
  reference_type: '0',
  reference_bone_name: '"Target"',
  reference_bone: '7',
  reference_node: 'NodePath("../Target")',
};

describe('AimModifier3D strict validators', () => {
  it('covers every leaf BoneConstraint3D actually contributes', () => {
    // The sample values cannot be derived, but the key set can. Without this, a new base leaf
    // leaves the case below missing the one key that would be misreported as unknown.
    expect(Object.keys(BASE_LEAF_KEYS).sort()).toEqual(
      Object.keys(BONE_CONSTRAINT_SETTING_LEAVES).sort()
    );
  });

  it('registers exactly what AimModifier3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('AimModifier3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run, not reasoned. `fixtureLint`
    // checks it against the whole registry through the barrel. This checks the same file
    // against only what this test imported.
    expectFixtureClean('unit-aim-modifier-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // check is generic on purpose, and per-property cases follow.
    const accepted = validatorRegistry
      .getOwnKeys('AimModifier3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('setting_count', () => {
    it('accepts zero and a positive count', () => {
      expect(check('setting_count', '0')).toBeNull();
      expect(check('setting_count', '4')).toBeNull();
    });

    it('errors below zero, the floor its setter refuses', () => {
      // bone_constraint_3d.cpp:131, ERR_FAIL_COND(p_count < 0).
      const error = check('setting_count', '-1');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_SETTING_COUNT_VALUE');
    });

    it('rejects a value that is not a number', () => {
      expect(check('setting_count', 'many')?.code).toBe('INVALID_SETTING_COUNT_FORMAT');
    });
  });

  describe('settings/<index>/forward_axis', () => {
    it('accepts every BoneAxis the hint lists', () => {
      for (const value of ['0', '1', '2', '3', '4', '5']) {
        expect(check('settings/0/forward_axis', value)).toBeNull();
      }
    });

    it('warns past the hint, which no setter enforces', () => {
      // aim_modifier_3d.cpp:91 hints "+X,-X,+Y,-Y,+Z,-Z", and set_forward_axis
      // (aim_modifier_3d.cpp:117) assigns straight through.
      const above = check('settings/0/forward_axis', '6');
      expect(above?.severity).toBe('warning');
      const below = check('settings/0/forward_axis', '-1');
      expect(below?.severity).toBe('warning');
    });

    it('rejects a non-integer', () => {
      expect(check('settings/0/forward_axis', 'up')?.code).toBe('INVALID_FORWARD_AXIS_FORMAT');
    });
  });

  describe('settings/<index>/primary_rotation_axis', () => {
    it('accepts X, Y and Z', () => {
      for (const value of ['0', '1', '2']) {
        expect(check('settings/1/primary_rotation_axis', value)).toBeNull();
      }
    });

    it('warns past the hint, which no setter enforces', () => {
      // aim_modifier_3d.cpp:93 hints "X,Y,Z", and set_primary_rotation_axis
      // (aim_modifier_3d.cpp:144) assigns straight through.
      expect(check('settings/1/primary_rotation_axis', '3')?.severity).toBe('warning');
    });

    it('rejects a non-integer', () => {
      expect(check('settings/1/primary_rotation_axis', 'Y')?.code).toBe(
        'INVALID_PRIMARY_ROTATION_AXIS_FORMAT'
      );
    });
  });

  describe.each(['use_euler', 'use_secondary_rotation', 'relative'])('settings/<index>/%s', (leaf) => {
    it('accepts true and false', () => {
      expect(check(`settings/2/${leaf}`, 'true')).toBeNull();
      expect(check(`settings/2/${leaf}`, 'false')).toBeNull();
    });

    it('rejects anything else', () => {
      expect(check(`settings/2/${leaf}`, 'maybe')?.severity).toBe('error');
    });
  });

  describe('the family BoneConstraint3D contributes', () => {
    it('passes every base leaf through instead of reporting an unknown key', () => {
      const rejected = Object.entries(BASE_LEAF_KEYS)
        .filter(([leaf, value]) => check(`settings/0/${leaf}`, value) !== null)
        .map(([leaf]) => leaf);
      expect(rejected).toEqual([]);
    });

    it("applies the base's bound to a base leaf, by delegating rather than owning it", () => {
      // `amount` is BoneConstraint3D's (bone_constraint_3d.cpp:102), and this dispatcher shadows the
      // base's registration for this type, so it forwards. Accepting the key unconditionally would
      // make `settings/0/amount = 5` legal here while a plain BoneConstraint3D bounds it to 0..1.
      expect(check('settings/0/amount', 'definitely-not-a-float')?.severity).toBe('error');
      expect(check('settings/0/amount', '5')?.severity).toBe('warning');
      expect(check('settings/0/amount', '0.5')).toBeNull();
    });
  });

  describe('the key shape itself', () => {
    it('rejects a leaf neither class declares', () => {
      expect(check('settings/0/bogus', 'true')?.code).toBe('INVALID_SETTING_KEY');
    });

    it('rejects a negative index, which the setter refuses outright', () => {
      // aim_modifier_3d.cpp:40, ERR_FAIL_INDEX_V(which, settings.size(), false).
      const error = check('settings/-1/relative', 'true');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_SETTING_INDEX');
    });

    it('leaves a non-integer index alone, because Godot applies that write', () => {
      // `path.get_slicec('/', 1).to_int()` (aim_modifier_3d.cpp:38) reads "x" as 0, with no
      // is_valid_int() guard, so `settings/x/relative` lands on setting 0. The key still routes
      // here, since an unrecognised leaf under it is dropped and must be reportable.
      expect(check('settings/x/relative', 'true')).toBeNull();
    });

    it('still rejects an unknown leaf behind a non-integer index', () => {
      // The index resolved to something, the leaf did not, so `_set` falls to
      // `return false` (aim_modifier_3d.cpp:52-54) and the write is dropped.
      expect(check('settings/x/bogus', 'true')?.code).toBe('INVALID_SETTING_KEY');
    });
  });

  it('inherits SkeletonModifier3D keys through the base-walk without re-declaring them', () => {
    expect(validatorRegistry.findValidator('AimModifier3D', 'influence')).not.toBeNull();
    expect(validatorRegistry.getOwnKeys('AimModifier3D')).not.toContain('influence');
  });
});
