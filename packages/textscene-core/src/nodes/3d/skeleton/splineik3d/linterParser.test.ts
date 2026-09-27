/**
 * SplineIK3D strict validators: format and range checks. Asserted through `validatorRegistry`, not
 * by linting a `.tscn`, so a failure points at the validator and not at scene parsing.
 * linter.test.ts tests rule behaviour through `Linter`. Every numeric bound quotes the Godot line
 * that states it.
 */

import { describe, expect, it } from 'vitest';
import { ValidatorRegistry, validatorRegistry } from '../../../../linter/ValidatorRegistry';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry';
import { NODE_BASE_TYPES } from '../../../../godot/nodeBaseTypes';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('SplineIK3D', property);
  expect(validator, `no validator registered for SplineIK3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly one, from the source rather than from expectation: list the keys SplineIK3D binds, or
 * set DECLARES_NOTHING when it binds no ADD_PROPERTY. Both unset is red on purpose. Do not delete
 * an assertion to go green.
 */
const KEYS: string[] = ['setting_count', 'settings/#/*'];
/** True only when the class binds no ADD_PROPERTY. Say which source line proves it. */
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
    // Runs the fixture's "zero errors and zero warnings" claim against the validators this test
    // imports. `fixtureLint` checks the same file against the whole registry.
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
    it('accepts a NodePath literal and the bare string the slot converts', () => {
      expect(check('settings/0/path_3d', 'NodePath("../SplinePath")')).toBeNull();
      expect(check('settings/7/path_3d', 'NodePath("")')).toBeNull();
      // variant.cpp:746-749 lists STRING (not STRING_NAME) as a strict source for NODE_PATH.
      expect(check('settings/0/path_3d', '"../SplinePath"')).toBeNull();
    });

    it('rejects a StringName and a bare word', () => {
      expect(check('settings/0/path_3d', '&"../SplinePath"')).not.toBeNull();
      expect(check('settings/0/path_3d', 'definitely-not-a-valid-value')).not.toBeNull();
    });

    it('checks a path written with a tail, which _set ignores', () => {
      // `what = path.get_slicec('/', 2)` (spline_ik_3d.cpp:38) is `path_3d`, so set_path_3d runs.
      expect(check('settings/0/path_3d/extra', '&"../SplinePath"')).not.toBeNull();
      expect(check('settings/0/tilt_fade_in/extra', '-2')?.severity).toBe('warning');
      expect(check('settings/0/path_3d/extra', 'NodePath("../SplinePath")')).toBeNull();
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

    it('leaves a NON-NUMERIC setting index alone, which `_set` resolves to 0', () => {
      // `path.get_slicec('/', 1).to_int()` (spline_ik_3d.cpp:37) has no is_valid_int() gate and
      // `_to_int` skips non-digits (ustring.cpp:2268-2298), so `x` reads as 0 and the write lands.
      // The value is still judged, because the leaf resolved either way.
      expect(check('settings/x/tilt_enabled', 'true')).toBeNull();
      expect(check('settings/x/tilt_fade_in', 'not-an-int')?.severity).toBe('error');
    });

    it('leaves a leaf no class in the chain declares alone', () => {
      // ChainIK3D keeps the family open, because a base cannot close a leaf set its descendants
      // extend. This slice is one of those descendants, so it makes the same choice.
      expect(check('settings/0/tilt_fade_sideways', '1')).toBeNull();
    });

    it('leaves a NESTED inherited key to the base walk rather than claiming it', () => {
      // `settings/0/end_bone/length` and `settings/0/joints/0/bone` are ChainIK3D's
      // (chain_ik_3d.cpp:132, :136). The glued-index pattern matches a single leaf segment, so
      // these resolve to the same validator a SplineIK3D-free lookup finds.
      for (const key of ['settings/0/end_bone/length', 'settings/0/joints/0/bone']) {
        const viaSpline = validatorRegistry.findValidator('SplineIK3D', key)!;
        const viaChain = validatorRegistry.findValidator('ChainIK3D', key)!;
        expect(viaSpline(key, '"x"', 1)).toEqual(viaChain(key, '"x"', 1));
      }
    });

    it('hands a FLAT inherited leaf to the ChainIK3D registration', () => {
      // The registry resolves one wildcard per key, and this slice's is nearer than ChainIK3D's, so
      // the dispatcher delegates or every inherited leaf reads as unknown. `root_bone` is ChainIK3D's
      // (chain_ik_3d.cpp:127), so the value its validator refuses is refused here, with its answer.
      const key = 'settings/0/root_bone';
      const viaChain = validatorRegistry.findValidator('ChainIK3D', key)!;
      expect(viaChain(key, 'not-an-int', 1)).not.toBeNull();

      expect(check(key, 'not-an-int')).toEqual(viaChain(key, 'not-an-int', 1));
      expect(check(key, '3')).toBeNull();
    });
  });

  describe('the ChainIK3D base walk', () => {
    it('hops to ChainIK3D, so every ancestor tier is reachable', () => {
      expect(NODE_BASE_TYPES['SplineIK3D']).toBe('ChainIK3D');
    });

    it('resolves an ancestor key without re-declaring it here', () => {
      // `mutable_bone_axes` is IKModifier3D's (ik_modifier_3d.cpp:64), two hops up. A sentinel in a
      // private registry, not the singleton, which already declares the key: the same walk over the
      // same base table proves this slice's hops on their own.
      const registry = new ValidatorRegistry(NODE_BASE_TYPES);
      const ikModifier: PropertyValidator = () => null;
      registry.registerAll('IKModifier3D', { mutable_bone_axes: ikModifier });

      expect(registry.findValidator('SplineIK3D', 'mutable_bone_axes')).toBe(ikModifier);
      expect(validatorRegistry.getOwnKeys('SplineIK3D')).not.toContain('mutable_bone_axes');
    });
  });
});
