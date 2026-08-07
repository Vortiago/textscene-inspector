/**
 * Bone2D strict validators: format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it.
 *
 * The load-bearing case here is `bone_angle`. Godot hints it `"-360, 360, 0.01"`
 * with no `radians_as_degrees` token, and `_set`/`_get` convert
 * (`skeleton_2d.cpp:47` `deg_to_rad` in, `:69` `rad_to_deg` out), so the value a
 * `.tscn` carries is DEGREES and the hint bound applies to it unconverted. A
 * radians bound would reject `bone_angle = 70.3277`, which Godot itself wrote.
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
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * Bone2D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 *
 * Two routes, not one: `rest` is the single ADD_PROPERTY (skeleton_2d.cpp:380),
 * and the other four arrive through the hand-rolled `_get_property_list`
 * (`:86`, `:88`, `:89`, `:93`). `default_length` is a FIFTH: a legacy alias for
 * `length` reached only through `_set`/`_get` (`:48-49`, `:70-71`), never
 * pushed into `_get_property_list` at all.
 */
const KEYS: string[] = [
  'rest',
  'auto_calculate_length_and_angle',
  'length',
  'bone_angle',
  'editor_settings/show_bone_gizmo',
  'default_length',
];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
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
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-bone-2d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
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
      // doc/classes/Bone2D.xml gives `Transform2D(0, 0, 0, 0, 0, 0)` as the
      // default. Godot's own configuration warning calls that "no proper REST
      // pose" (skeleton_2d.cpp:424), but the setter stores it unaltered and it
      // is what an untouched bone serialises, so the linter must not reject it.
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
      expect(error?.severity).toBe('error');
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
      // so the finite guard does not apply; every comparison against nan is
      // false, so no bound fires either.
      expect(check('length', 'nan')).toBeNull();
    });
  });

  describe('bone_angle', () => {
    it.each(['70.3277', '-2.49648'])('accepts the DEGREE value %s that Godot serialised', (value) => {
      // Straight out of the vendored player skeleton. Both are stored degrees;
      // 70.3277 is 11 full turns as radians, so a radians bound would reject a
      // file the engine wrote.
      expect(check('bone_angle', value)).toBeNull();
    });

    it.each(['-360', '0.0', '360'])('accepts the inclusive hint bound %s', (value) => {
      expect(check('bone_angle', value)).toBeNull();
    });

    it.each(['-360.5', '360.5'])('warns rather than errors outside the hint (%s)', (value) => {
      // skeleton_2d.cpp:89 hints "-360, 360, 0.01"; set_bone_angle (:475-481)
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
      // Both directions on purpose: a one-sided "it resolves" assertion still
      // passes when the key was shadowed by a duplicate registration here.
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

  describe('default_length', () => {
    it.each(['1', '1024'])('accepts the inclusive hint bound %s (skeleton_2d.cpp:88, shared with length)', (value) => {
      expect(check('default_length', value)).toBeNull();
    });

    it.each(['0.5', '1024.5'])('warns rather than errors outside the hint (%s)', (value) => {
      // skeleton_2d.cpp:48-49 aliases straight into set_length (:463-469),
      // a bare assignment with no clamp and no ERR_FAIL — the same bound
      // `length` itself carries, so out of range is a warning.
      const error = check('default_length', value);
      expect(error?.severity).toBe('warning');
      expect(error?.message).toContain('default_length');
    });

    it('rejects text that is not a float at all', () => {
      expect(check('default_length', 'long')?.severity).toBe('error');
    });
  });
});
