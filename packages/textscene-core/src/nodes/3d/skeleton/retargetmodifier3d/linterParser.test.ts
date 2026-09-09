/**
 * RetargetModifier3D strict validators - format and range checks.
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
  const validator = validatorRegistry.declarationFor('RetargetModifier3D', property);
  expect(validator, `no validator registered for RetargetModifier3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The keys RetargetModifier3D binds itself: three `ADD_PROPERTY` calls at
 * retarget_modifier_3d.cpp:273-275, and no other route into a `.tscn` (the
 * class declares no `_set`/`_get`, no `get_property_list`, no
 * `PropertyListHelper` and no `ADD_ARRAY_COUNT`).
 */
const KEYS: string[] = ['enable', 'profile', 'use_global_pose'];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

describe('RetargetModifier3D strict validators', () => {
  it('registers exactly what RetargetModifier3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('RetargetModifier3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-retarget-modifier-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('RetargetModifier3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('enable', () => {
    it('accepts every subset of the three hinted bits', () => {
      // TRANSFORM_FLAG_POSITION | ROTATION | SCALE = 1 | 2 | 4
      // (retarget_modifier_3d.h:41-44); 7 is the property default.
      for (const value of ['0', '1', '2', '3', '4', '5', '6', '7']) {
        expect(check('enable', value), `enable = ${value}`).toBeNull();
      }
    });

    it('warns for a bit the inspector flag list does not offer', () => {
      // set_enable_flags bare-assigns (retarget_modifier_3d.cpp:411), so bit 8
      // is KEPT rather than masked away: the value loads and runs, and only the
      // inspector cannot reach it. That is the hint tier, not the setter tier.
      const error = check('enable', '8');
      expect(error?.severity).toBe('warning');
      expect(error?.message).toContain('TRANSFORM_FLAG_POSITION');
    });

    it('warns for a negative value', () => {
      expect(check('enable', '-1')?.severity).toBe('warning');
    });

    it('truncates a float rather than calling it a format error', () => {
      // An INT slot takes any number token and converts, so `1.5` stores 1.
      expect(check('enable', '1.5')?.code).not.toBe('INVALID_ENABLE_FORMAT');
    });

    it('still rejects a literal Godot cannot tokenise', () => {
      const error = check('enable', 'abc');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_ENABLE_FORMAT');
    });

    it('cites the ADD_PROPERTY whose PROPERTY_HINT_FLAGS lists the bits', () => {
      const validator = validatorRegistry.declarationFor('RetargetModifier3D', 'enable');
      expect(validator!.grounding).toEqual({
        kind: 'hinted',
        cite: 'retarget_modifier_3d.cpp:275',
      });
    });
  });

  describe('profile', () => {
    it('accepts both resource reference spellings', () => {
      expect(check('profile', 'SubResource("SkeletonProfileHumanoid_c7g4k")')).toBeNull();
      expect(check('profile', 'ExtResource("1_profile")')).toBeNull();
    });

    it('rejects anything that is not a resource reference', () => {
      const error = check('profile', '"res://profile.tres"');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_PROFILE_REFERENCE');
    });

    it('rejects only what Godot could not read either, so it needs no citation', () => {
      // PROPERTY_HINT_RESOURCE_TYPE "SkeletonProfile"
      // (retarget_modifier_3d.cpp:273) narrows the inspector's picker, not the
      // .tscn grammar, and set_profile (:381-386) takes any Ref through
      // _profile_changed with no guard. Whether the id resolves is
      // resourceChecker's question, not a format one.
      const validator = validatorRegistry.declarationFor('RetargetModifier3D', 'profile');
      expect(validator!.formatOnly).toBe(true);
      expect(validator!.grounding).toBeUndefined();
    });
  });

  describe('use_global_pose', () => {
    it('accepts both boolean literals', () => {
      expect(check('use_global_pose', 'true')).toBeNull();
      expect(check('use_global_pose', 'false')).toBeNull();
    });

    it('rejects a non-boolean', () => {
      const error = check('use_global_pose', '1');
      expect(error?.severity).toBe('warning');
      expect(error?.code).toBe('INVALID_USE_GLOBAL_POSE_FORMAT');
    });
  });

  describe('the SkeletonModifier3D base walk', () => {
    it('resolves influence from the ancestor rather than a copy declared here', () => {
      // Re-declaring an inherited key here would shadow SkeletonModifier3D's and
      // duplicate the bound, so the slice must own neither `influence` nor
      // `active` while still validating both.
      expect(validatorRegistry.getOwnKeys('RetargetModifier3D')).not.toContain('influence');
      expect(validatorRegistry.getOwnKeys('RetargetModifier3D')).not.toContain('active');

      expect(check('influence', '0.75')).toBeNull();
      // skeleton_modifier_3d.cpp:161 hints "0,1,0.001" and set_influence (:111)
      // bare-assigns, so past the ceiling is the hint tier.
      expect(check('influence', '1.5')?.severity).toBe('warning');
      expect(check('active', 'false')).toBeNull();
    });
  });
});
