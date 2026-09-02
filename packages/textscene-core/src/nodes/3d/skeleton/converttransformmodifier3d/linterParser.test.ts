/**
 * ConvertTransformModifier3D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('ConvertTransformModifier3D', property);
  expect(validator, `no validator registered for ConvertTransformModifier3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * `setting_count` is the class's one ADD_ARRAY_COUNT
 * (convert_transform_modifier_3d.cpp:329); everything else it serialises is the
 * hand-rolled `settings/<i>/` family from `_get_property_list` (:125-167), which
 * appears in no macro at all.
 *
 * The family registers under the PLAIN `settings/*` wildcard. Eight of its ten
 * leaves are two segments (`apply/transform_mode`); the dispatcher, not the
 * registry's matcher, reads that depth.
 */
const KEYS: string[] = ['setting_count', 'settings/*'];

describe('ConvertTransformModifier3D strict validators', () => {
  it('registers exactly what ConvertTransformModifier3D binds', () => {
    expect(validatorRegistry.getOwnKeys('ConvertTransformModifier3D').sort()).toEqual(
      [...KEYS].sort()
    );
  });

  it('accepts every value its own fixture carries', () => {
    expectFixtureClean('unit-convert-transform-modifier-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    const accepted = validatorRegistry
      .getOwnKeys('ConvertTransformModifier3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('setting_count', () => {
    it('accepts a non-negative count', () => {
      expect(check('setting_count', '3')).toBeNull();
    });

    it('ERRORS below zero, which BoneConstraint3D::set_setting_count refuses', () => {
      // ERR_FAIL_COND(p_count < 0), bone_constraint_3d.cpp:131.
      expect(check('setting_count', '-1')?.severity).toBe('error');
    });
  });

  describe('the two-segment apply/ and reference/ groups', () => {
    it.each([
      'settings/0/apply/transform_mode',
      'settings/0/reference/transform_mode',
    ])('%s accepts the three TransformMode values', (key) => {
      for (const value of ['0', '1', '2']) expect(check(key, value)).toBeNull();
    });

    it.each([
      'settings/0/apply/transform_mode',
      'settings/0/reference/transform_mode',
    ])('%s WARNS outside the enum, since the setter only static_casts', (key) => {
      expect(check(key, '3')?.severity).toBe('warning');
      expect(check(key, '-1')?.severity).toBe('warning');
    });

    it.each(['settings/0/apply/axis', 'settings/0/reference/axis'])(
      '%s accepts X, Y and Z and warns beyond them',
      (key) => {
        for (const value of ['0', '1', '2']) expect(check(key, value)).toBeNull();
        expect(check(key, '3')?.severity).toBe('warning');
      }
    );

    it.each([
      'settings/0/apply/range_min',
      'settings/0/apply/range_max',
      'settings/0/reference/range_min',
      'settings/0/reference/range_max',
    ])('%s claims no magnitude bound, because the hint depends on a sibling', (key) => {
      // Which of HINT_POSITION / HINT_ROTATION / HINT_SCALE applies is chosen
      // from the sibling transform_mode (convert_transform_modifier_3d.cpp:134-140),
      // and HINT_POSITION opens BOTH ends. The mode-conditional bound is
      // linter.ts's; only the float format is checkable here.
      for (const value of ['-1000', '0', '1000', 'inf', '-inf', 'nan']) {
        expect(check(key, value)).toBeNull();
      }
      expect(check(key, 'not-a-float')?.severity).toBe('error');
    });

    it('reports the WHOLE key for an unrecognised leaf under apply/', () => {
      const error = check('settings/0/apply/nope', '1');
      expect(error?.code).toBe('INVALID_SETTING_KEY');
      expect(error?.message).toContain('settings/0/apply/nope');
    });
  });

  describe('the single-segment leaves', () => {
    it.each(['settings/0/relative', 'settings/0/additive'])('%s takes a bool', (key) => {
      expect(check(key, 'true')).toBeNull();
      expect(check(key, 'false')).toBeNull();
      expect(check(key, '1')).not.toBeNull();
    });
  });

  describe('the BoneConstraint3D leaves in the same family', () => {
    it('delegates settings/0/amount to the base, bound and all', () => {
      expect(check('settings/0/amount', '0.5')).toBeNull();
      // hinted 0..1 at bone_constraint_3d.cpp:102 with a bare-assign setter.
      expect(check('settings/0/amount', '5')?.severity).toBe('warning');
    });

    it('keeps apply_bone apart from the apply/ group despite the shared prefix', () => {
      // `apply_bone` is BoneConstraint3D's flat leaf; `apply/axis` is this
      // class's nested one. The index split must not merge them.
      expect(check('settings/0/apply_bone', '4')).toBeNull();
      expect(check('settings/0/apply_bone', 'not-an-int')?.severity).toBe('error');
    });

    it('delegates the remaining base leaves rather than reporting them unknown', () => {
      expect(check('settings/0/apply_bone_name', '"Head"')).toBeNull();
      expect(check('settings/0/reference_bone_name', '"Chest"')).toBeNull();
      expect(check('settings/0/reference_bone', '2')).toBeNull();
      expect(check('settings/0/reference_type', '1')).toBeNull();
      expect(check('settings/0/reference_node', 'NodePath("../Target")')).toBeNull();
    });
  });

  describe('the family dispatcher', () => {
    it('errors on a negative setting index, which _set refuses outright', () => {
      // ERR_FAIL_INDEX_V(which, (int)settings.size(), false),
      // convert_transform_modifier_3d.cpp:43.
      const error = check('settings/-1/apply/axis', '1');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_SETTING_INDEX');
    });

    it('errors on a negative index under a flat leaf too', () => {
      expect(check('settings/-2/relative', 'true')?.code).toBe('INVALID_SETTING_INDEX');
    });

    it('rejects a key carrying no index segment at all', () => {
      expect(check('settings/nope', 'true')?.code).toBe('INVALID_SETTING_KEY');
    });

    it('leaves a non-numeric index alone, because to_int resolves it and the write lands', () => {
      // `_set` reads `path.get_slicec('/', 1).to_int()`
      // (convert_transform_modifier_3d.cpp:41) with no is_valid_int gate, and
      // `_to_int` skips non-digits (ustring.cpp:2268-2298), so "x" is 0 and
      // set_relative(0, true) really runs. Nothing refuses it, so ADR-0032
      // grounds nothing. This is NOT the PropertyListHelper parse.
      expect(check('settings/x/relative', 'true')).toBeNull();
    });

    it('leaves a BASE leaf under a non-numeric index alone too', () => {
      // The delegation hop must not re-introduce the false positive the direct
      // path just lost. BoneConstraint3D's `settings/#/*` routes the key, and
      // its `to_int` parse resolves `x` to setting 0 (bone_constraint_3d.cpp:37),
      // so the write lands and the value is judged as any other.
      expect(check('settings/x/amount', '0.5')).toBeNull();
    });

    it('still rejects an unknown leaf under a non-numeric index', () => {
      // The index resolves; the leaf does not, so `_set` falls to its
      // `return false` (convert_transform_modifier_3d.cpp:74-76) and the write
      // is dropped.
      expect(check('settings/x/made_up', '1')?.code).toBe('INVALID_SETTING_KEY');
    });

    it('rejects a leaf name no class in the chain declares', () => {
      expect(check('settings/0/made_up', '1')?.code).toBe('INVALID_SETTING_KEY');
    });
  });
});
