/**
 * Bone2D strict validators: format and range checks, asserted through
 * `validatorRegistry`. `bone_angle` is stored in degrees: `_set`/`_get` convert
 * (`skeleton_2d.cpp:47` `deg_to_rad` in, `:69` `rad_to_deg` out), so the hint
 * `"-360, 360, 0.01"` applies unconverted and Godot's own `70.3277` passes.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('Bone2D', property);
  expect(validator, `no validator registered for Bone2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The keys Bone2D binds, read from the source. `rest` is the one ADD_PROPERTY
 * (skeleton_2d.cpp:380), and the other four come from `_get_property_list` (`:86`,
 * `:88`, `:89`, `:93`). `default_length` (`:48-49`, `:70-71`) is an alias that
 * `godot/deprecated.ts` resolves.
 */
const KEYS: string[] = [
  'rest',
  'auto_calculate_length_and_angle',
  'length',
  'bone_angle',
  'editor_settings/show_bone_gizmo',
];
/** True only when the class binds no ADD_PROPERTY, with the source line that proves it. */
const DECLARES_NOTHING = false;

describe('Bone2D strict validators', () => {
  it('registers exactly what Bone2D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('Bone2D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run against what this
    // test imported. `fixtureLint` owns the whole-registry version through the barrel.
    expectFixtureClean('unit-bone-2d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose validates no format.
    const accepted = validatorRegistry
      .getOwnKeys('Bone2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('rest', () => {
    it('accepts the six-float Transform2D Godot writes', () => {
      // The corpus form: a rotation/scale basis plus the bone offset.
      expect(check('rest', 'Transform2D(0.999999, 0.00169551, -0.00169551, 0.999999, 0, -49)')).toBeNull();
    });

    it('accepts the degenerate all-zero default', () => {
      // doc/classes/Bone2D.xml gives `Transform2D(0, 0, 0, 0, 0, 0)` as the default.
      // The configuration warning calls it "no proper REST pose" (skeleton_2d.cpp:424),
      // but the setter stores it unaltered, so the validator accepts it.
      expect(check('rest', 'Transform2D(0, 0, 0, 0, 0, 0)')).toBeNull();
    });

    it('rejects a Transform2D of the wrong arity', () => {
      const error = check('rest', 'Transform2D(1, 0, 0)');
      expect(error?.severity).toBe('error');
      expect(error?.message).toContain('rest');
    });
  });

  describe('auto_calculate_length_and_angle', () => {
    it.each(['true', 'false'])('accepts %s', (value) => {
      expect(check('auto_calculate_length_and_angle', value)).toBeNull();
    });

    it('rejects a numeric stand-in for a boolean', () => {
      const error = check('auto_calculate_length_and_angle', '1');
      expect(error?.severity).toBe('warning');
    });
  });

  describe('length', () => {
    it('accepts the default the corpus carries', () => {
      // skeleton_2d.h:51 declares `real_t length = 16`.
      expect(check('length', '16.0')).toBeNull();
    });

    it.each(['1', '1024'])('accepts the inclusive hint bound %s', (value) => {
      expect(check('length', value)).toBeNull();
    });

    it.each(['0.5', '1024.5'])('warns rather than errors outside the hint (%s)', (value) => {
      // skeleton_2d.cpp:88 hints "1, 1024, 1" with neither `or_greater` nor
      // `or_less`, and set_length (:463-469) assigns straight through with no
      // clamp and no ERR_FAIL, so the bound is the widget's and ADR-0032 makes it
      // a warning.
      const error = check('length', value);
      expect(error?.severity).toBe('warning');
      expect(error?.message).toContain('length');
    });

    it('rejects text that is not a float at all', () => {
      expect(check('length', 'long')?.severity).toBe('error');
    });

    it('accepts nan, a literal Godot writes and reloads', () => {
      // No `ERR_FAIL_COND(!is_finite(...))` in set_length (skeleton_2d.cpp:463),
      // so the finite guard does not apply. Every comparison against nan is
      // false, so no bound fires either.
      expect(check('length', 'nan')).toBeNull();
    });
  });

  describe('bone_angle', () => {
    it.each(['70.3277', '-2.49648'])('accepts the DEGREE value %s that Godot serialised', (value) => {
      // Both are stored degrees. 70.3277 is 11 full turns as radians, so a radians
      // bound would reject a file the engine wrote.
      expect(check('bone_angle', value)).toBeNull();
    });

    it.each(['-360', '0.0', '360'])('accepts the inclusive hint bound %s', (value) => {
      expect(check('bone_angle', value)).toBeNull();
    });

    it.each(['-360.5', '360.5'])('warns rather than errors outside the hint (%s)', (value) => {
      // skeleton_2d.cpp:89 hints "-360, 360, 0.01". set_bone_angle (:475-481)
      // assigns straight through, so out of range is the widget's complaint.
      const error = check('bone_angle', value);
      expect(error?.severity).toBe('warning');
      expect(error?.message).toContain('bone_angle');
    });

    it('rejects text that is not a float at all', () => {
      expect(check('bone_angle', 'sideways')?.severity).toBe('error');
    });
  });

  describe('editor_settings/show_bone_gizmo', () => {
    it.each(['true', 'false'])('accepts %s', (value) => {
      // TOOLS_ENABLED-only (skeleton_2d.cpp:93), but PROPERTY_USAGE_DEFAULT
      // includes STORAGE and only editor builds write `.tscn` files, so a scene
      // saved with the gizmo toggled off carries this key.
      expect(check('editor_settings/show_bone_gizmo', value)).toBeNull();
    });

    it('rejects a non-boolean', () => {
      expect(check('editor_settings/show_bone_gizmo', '"off"')?.severity).toBe('error');
    });
  });

  describe('the base walk', () => {
    it('resolves Node2D and CanvasItem keys without Bone2D re-declaring them', () => {
      // Both directions: a one-sided "it resolves" assertion still passes when a
      // duplicate registration here shadows the key.
      for (const inherited of ['position', 'rotation', 'visible', 'z_index']) {
        expect(
          validatorRegistry.findValidator('Bone2D', inherited),
          `${inherited} must reach Bone2D through the base walk`
        ).not.toBeNull();
        expect(validatorRegistry.getOwnKeys('Bone2D')).not.toContain(inherited);
      }
    });

    it('leaves a key no ancestor declares unresolved', () => {
      expect(validatorRegistry.findValidator('Bone2D', 'not_a_real_bone2d_key')).toBeNull();
    });
  });
});
