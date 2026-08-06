/**
 * XRBodyModifier3D strict validators - format and range checks.
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
  const validator = validatorRegistry.findValidator('XRBodyModifier3D', property);
  expect(validator, `no validator registered for XRBodyModifier3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The keys XRBodyModifier3D binds itself: three `ADD_PROPERTY` calls at
 * xr_body_modifier_3d.cpp:46-48, and no other route into a `.tscn` (the class
 * declares no `_set`/`_get`, no `get_property_list`, no `_validate_property`, no
 * `PropertyListHelper` and no `ADD_ARRAY_COUNT`, and has no `.compat.inc`).
 */
const KEYS: string[] = ['body_tracker', 'body_update', 'bone_update'];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

describe('XRBodyModifier3D strict validators', () => {
  it('registers exactly what XRBodyModifier3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('XRBodyModifier3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-xr-body-modifier-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('XRBodyModifier3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('body_tracker', () => {
    it('accepts the StringName spelling Godot actually saves', () => {
      // ADD_PROPERTY declares Variant::STRING (xr_body_modifier_3d.cpp:46) but
      // get_body_tracker returns StringName (xr_body_modifier_3d.h:60), and the
      // getter is what the serializer reads, so the saved form is &"...".
      expect(check('body_tracker', '&"/user/body_tracker"')).toBeNull();
    });

    it('accepts the plain quoted form the variant parser also reads', () => {
      expect(check('body_tracker', '"/user/body_tracker"')).toBeNull();
    });

    it('rejects an unquoted bareword as a format error', () => {
      const error = check('body_tracker', '/user/body_tracker');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_BODY_TRACKER_FORMAT');
    });

    it('accepts a name outside the hint suggestion, so it needs no citation', () => {
      // PROPERTY_HINT_ENUM_SUGGESTION (xr_body_modifier_3d.cpp:46) seeds the
      // inspector's dropdown and still takes an arbitrary string, and
      // set_body_tracker bare-assigns (:60), so there is no bound to ground.
      // Whether a tracker of that name is registered with XRServer is a runtime
      // question no `.tscn` can answer.
      expect(check('body_tracker', '&"/user/custom_body_tracker"')).toBeNull();
      const validator = validatorRegistry.findValidator('XRBodyModifier3D', 'body_tracker');
      expect(validator!.formatOnly).toBe(true);
      expect(validator!.grounding).toBeUndefined();
    });
  });

  describe('body_update', () => {
    it('accepts every subset of the three hinted bits', () => {
      // BODY_UPDATE_UPPER_BODY | LOWER_BODY | HANDS = 1 | 2 | 4
      // (xr_body_modifier_3d.h:48-50); 7 is the property default (:83).
      for (const value of ['0', '1', '2', '3', '4', '5', '6', '7']) {
        expect(check('body_update', value), `body_update = ${value}`).toBeNull();
      }
    });

    it('warns for a bit the inspector flag list does not offer', () => {
      // set_body_update bare-assigns (xr_body_modifier_3d.cpp:68) with no mask,
      // so Godot KEEPS bit 8: the scene loads, the BitField holds 15, and
      // _get_joint_data simply never tests a bit nobody defined. Only the
      // inspector cannot reach it, which is the hint tier and not the setter tier.
      const error = check('body_update', '15');
      expect(error?.severity).toBe('warning');
      expect(error?.message).toContain('BODY_UPDATE_UPPER_BODY');
    });

    it('warns for a negative value', () => {
      expect(check('body_update', '-1')?.severity).toBe('warning');
    });

    it('rejects a non-integer as a format error', () => {
      const error = check('body_update', '1.5');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_BODY_UPDATE_FORMAT');
    });

    it('cites the ADD_PROPERTY whose PROPERTY_HINT_FLAGS lists the bits', () => {
      const validator = validatorRegistry.findValidator('XRBodyModifier3D', 'body_update');
      expect(validator!.grounding).toEqual({
        kind: 'hinted',
        cite: 'xr_body_modifier_3d.cpp:47',
      });
    });
  });

  describe('bone_update', () => {
    it('accepts both BoneUpdate constants', () => {
      expect(check('bone_update', '0')).toBeNull();
      expect(check('bone_update', '1')).toBeNull();
    });

    it('errors past the last constant, because the setter refuses it', () => {
      // ERR_FAIL_INDEX(p_bone_update, BONE_UPDATE_MAX) (xr_body_modifier_3d.cpp:80)
      // with BONE_UPDATE_MAX = 2 (xr_body_modifier_3d.h:56): 2 returns early and
      // bone_update keeps whatever it held, so the written value is not the
      // stored one.
      const error = check('bone_update', '2');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_BONE_UPDATE_VALUE');
      expect(error?.message).toContain('BONE_UPDATE_ROTATION_ONLY');
    });

    it('errors below zero, the other end of the same guard', () => {
      expect(check('bone_update', '-1')?.severity).toBe('error');
    });

    it('rejects a constant name as a format error', () => {
      // A `.tscn` stores the integer; the identifier is GDScript-only.
      const error = check('bone_update', 'BONE_UPDATE_ROTATION_ONLY');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_BONE_UPDATE_FORMAT');
    });

    it('cites the ERR_FAIL_INDEX in the setter, not the enum hint', () => {
      const validator = validatorRegistry.findValidator('XRBodyModifier3D', 'bone_update');
      expect(validator!.grounding).toEqual({
        kind: 'enforced',
        cite: 'xr_body_modifier_3d.cpp:80',
      });
    });
  });

  describe('the SkeletonModifier3D base walk', () => {
    it('resolves influence from the ancestor rather than a copy declared here', () => {
      // Re-declaring an inherited key here would shadow SkeletonModifier3D's and
      // duplicate the bound, so the slice must own neither `influence` nor
      // `active` while still validating both.
      expect(validatorRegistry.getOwnKeys('XRBodyModifier3D')).not.toContain('influence');
      expect(validatorRegistry.getOwnKeys('XRBodyModifier3D')).not.toContain('active');

      expect(check('influence', '0.75')).toBeNull();
      // skeleton_modifier_3d.cpp:161 hints "0,1,0.001" and set_influence (:111)
      // bare-assigns, so past the ceiling is the hint tier.
      expect(check('influence', '1.5')?.severity).toBe('warning');
      expect(check('active', 'false')).toBeNull();
    });
  });
});
