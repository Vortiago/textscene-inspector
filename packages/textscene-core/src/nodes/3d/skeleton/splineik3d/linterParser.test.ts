/**
 * SplineIK3D strict validators: format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * Every numeric bound quotes the Godot line that states it.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { NODE_BASE_TYPES } from '../../../../linter/nodeBaseTypes';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import { v } from '../../../../linter/validators/v';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('SplineIK3D', property);
  expect(validator, `no validator registered for SplineIK3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * SplineIK3D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = ['setting_count', 'settings/#/*'];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

describe('SplineIK3D strict validators', () => {
  it('registers exactly what SplineIK3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('SplineIK3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-spline-ik-3d.tscn');
  });

  describe('setting_count', () => {
    it('accepts a count Godot can allocate', () => {
      expect(check('setting_count', '0')).toBeNull();
      expect(check('setting_count', '2')).toBeNull();
      // No ceiling anywhere: ADD_ARRAY_COUNT carries PROPERTY_HINT_NONE.
      expect(check('setting_count', '4096')).toBeNull();
    });

    it('errors on a negative count, which the setter refuses outright', () => {
      // `ERR_FAIL_COND(p_count < 0)` in _set_setting_count, ik_modifier_3d.h:98.
      const error = check('setting_count', '-1');
      expect(error?.severity).toBe('error');
    });

    it('rejects a non-integer count', () => {
      expect(check('setting_count', '1.5')).not.toBeNull();
      expect(check('setting_count', 'many')).not.toBeNull();
    });
  });

  describe('settings/<i>/path_3d', () => {
    it('accepts a NodePath literal', () => {
      expect(check('settings/0/path_3d', 'NodePath("../SplinePath")')).toBeNull();
      expect(check('settings/7/path_3d', 'NodePath("")')).toBeNull();
    });

    it('rejects anything that is not a NodePath literal', () => {
      expect(check('settings/0/path_3d', '"../SplinePath"')).not.toBeNull();
      expect(check('settings/0/path_3d', 'definitely-not-a-valid-value')).not.toBeNull();
    });
  });

  describe('settings/<i>/tilt_enabled', () => {
    it('accepts both booleans', () => {
      expect(check('settings/0/tilt_enabled', 'true')).toBeNull();
      expect(check('settings/0/tilt_enabled', 'false')).toBeNull();
    });

    it('rejects a non-boolean', () => {
      expect(check('settings/0/tilt_enabled', 'yes')).not.toBeNull();
    });
  });

  describe.each(['tilt_fade_in', 'tilt_fade_out'])('settings/<i>/%s', (leaf) => {
    const key = `settings/0/${leaf}`;

    it('accepts the hint range and everything above it', () => {
      // PROPERTY_HINT_RANGE "-1,100,1,or_greater" at spline_ik_3d.cpp:85-86.
      expect(check(key, '-1')).toBeNull();
      expect(check(key, '0')).toBeNull();
      expect(check(key, '100')).toBeNull();
      // `or_greater` opens the max end, so no ceiling is ever reported.
      expect(check(key, '5000')).toBeNull();
    });

    it('warns below the hint floor, which the setter still stores', () => {
      // set_tilt_fade_in/out assign straight through (spline_ik_3d.cpp:147, :157),
      // so the hint's -1 floor is advisory (ADR-0032).
      const diagnostic = check(key, '-2');
      expect(diagnostic?.severity).toBe('warning');
    });

    it('rejects a non-integer size', () => {
      expect(check(key, '1.5')).not.toBeNull();
      expect(check(key, 'four')).not.toBeNull();
    });
  });

  describe('the settings/ family dispatcher', () => {
    it('errors on a negative setting index, which `_set` refuses', () => {
      // ERR_FAIL_INDEX_V(which, (int)settings.size(), false) at spline_ik_3d.cpp:39.
      const error = check('settings/-1/path_3d', 'NodePath("../SplinePath")');
      expect(error?.severity).toBe('error');
    });

    it('leaves a leaf no class in the chain declares alone', () => {
      // ChainIK3D keeps the family OPEN on purpose, because a base cannot close
      // a leaf set its descendants extend; this slice is one of those
      // descendants, so it makes the same choice rather than erroring on a leaf
      // a sibling tier may still add.
      expect(check('settings/0/tilt_fade_sideways', '1')).toBeNull();
    });

    it('leaves a NESTED inherited key to the base walk rather than claiming it', () => {
      // `settings/0/end_bone/length` and `settings/0/joints/0/bone` are
      // ChainIK3D's (chain_ik_3d.cpp:132, :136). The glued-index pattern matches
      // a SINGLE leaf segment, so these must resolve to the very same validator
      // a SplineIK3D-free lookup finds, and nothing here may intercept them.
      for (const key of ['settings/0/end_bone/length', 'settings/0/joints/0/bone']) {
        expect(validatorRegistry.findValidator('SplineIK3D', key)).toBe(
          validatorRegistry.findValidator('ChainIK3D', key)
        );
      }
    });

    it('hands a FLAT inherited leaf to the ChainIK3D registration', () => {
      // The registry resolves ONE wildcard per key, and this slice's is nearer
      // than ChainIK3D's, so the dispatcher has to delegate or every inherited
      // leaf reads as unknown. Probed with an exact key so the real ChainIK3D
      // wildcard registration, whenever it lands, is not clobbered here.
      const probe = v.strictInt('root_bone');
      validatorRegistry.registerAll('ChainIK3D', { 'settings/0/root_bone': probe });

      expect(check('settings/0/root_bone', '3')).toBeNull();
      expect(check('settings/0/root_bone', 'not-an-int')).not.toBeNull();
    });
  });

  describe('the ChainIK3D base walk', () => {
    it('hops to ChainIK3D, so every ancestor tier is reachable', () => {
      expect(NODE_BASE_TYPES['SplineIK3D']).toBe('ChainIK3D');
    });

    it('resolves an ancestor key without re-declaring it here', () => {
      // `mutable_bone_axes` is IKModifier3D's (ik_modifier_3d.cpp:64), two hops
      // up. Probed rather than assumed live, so this slice's base walk is
      // provable while the ancestor tiers are still being written.
      const probe = v.boolean('mutable_bone_axes');
      validatorRegistry.registerAll('IKModifier3D', { mutable_bone_axes: probe });

      expect(validatorRegistry.findValidator('SplineIK3D', 'mutable_bone_axes')).toBe(probe);
      expect(validatorRegistry.getOwnKeys('SplineIK3D')).not.toContain('mutable_bone_axes');
    });
  });
});
