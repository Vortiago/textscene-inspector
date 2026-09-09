/**
 * RootMotionView strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * Grow this into one case per property — happy, malformed, and any bound — and
 * quote the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('RootMotionView', property);
  expect(validator, `no validator registered for RootMotionView.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * From root_motion_view.cpp:189-193: five ADD_PROPERTY calls, none
 * `overrides=`-only in doc/classes/RootMotionView.xml: animation_path,
 * cell_size, color, radius, zero_y.
 */
const KEYS: string[] = ['animation_path', 'cell_size', 'color', 'radius', 'zero_y'];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys RootMotionView does NOT declare, each paired with the ancestor that does.
 * Name at least one; VisualInstance3D is where to start.
 *
 * This is the assertion the malformed-value sweep below CANNOT make. That sweep
 * iterates `getOwnKeys`, so on a class that rightly declares nothing it sweeps
 * an EMPTY set and passes while asserting nothing — "Godot gives RootMotionView no
 * properties of its own" and "nobody has written this slice yet" look identical
 * to it. Resolving a key through the base-walk to the ancestor's own validator
 * function tells the two apart, and it is red until filled for the same reason
 * KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [['VisualInstance3D', 'layers']];

describe('RootMotionView strict validators', () => {
  it('registers exactly what RootMotionView binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('RootMotionView').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-root-motion-view.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // RootMotionView declares nothing, which is what INHERITED below covers.
    const accepted = validatorRegistry
      .getOwnKeys('RootMotionView')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key RootMotionView inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The SAME function, not merely some validator: a shadowing copy on
      // RootMotionView would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('RootMotionView', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('RootMotionView')).not.toContain(key);
    }
  });

  // root_motion_view.cpp:189: ADD_PROPERTY(PropertyInfo(Variant::NODE_PATH,
  // "animation_path", PROPERTY_HINT_NODE_PATH_VALID_TYPES, "AnimationMixer"),
  // "set_animation_path", "get_animation_path"). set_animation_mixer
  // (root_motion_view.cpp:38-41) assigns straight through with no validation.
  describe('animation_path', () => {
    it('accepts a typical value', () => {
      expect(check('animation_path', 'NodePath("../Player")')).toBeNull();
    });

    it('rejects a bare, unwrapped path', () => {
      expect(check('animation_path', 'Player')?.code).toBe('INVALID_ANIMATION_PATH_PATH');
    });

    it('accepts the empty path, since the hint only narrows the editor picker, not the grammar', () => {
      expect(check('animation_path', 'NodePath("")')).toBeNull();
    });
  });

  // root_motion_view.cpp:190: ADD_PROPERTY(PropertyInfo(Variant::COLOR, "color"),
  // "set_color", "get_color"); PROPERTY_HINT_NONE, and set_color
  // (root_motion_view.cpp:47-50) assigns straight through.
  describe('color', () => {
    it('accepts a typical value', () => {
      expect(check('color', 'Color(0.5, 0.5, 1, 1)')).toBeNull();
    });

    it('rejects a non-Color value', () => {
      expect(check('color', 'not-a-color')?.code).toBe('INVALID_COLOR_FORMAT');
    });

    it('accepts components outside 0-1, since a Color has no numeric bound (HDR is legal)', () => {
      expect(check('color', 'Color(2.5, -1, 0, 1)')).toBeNull();
    });
  });

  // root_motion_view.cpp:191: ADD_PROPERTY(PropertyInfo(Variant::FLOAT,
  // "cell_size", PROPERTY_HINT_RANGE, "0.1,16,0.01,or_greater,suffix:m"),
  // "set_cell_size", "get_cell_size"). set_cell_size (root_motion_view.cpp:56-59)
  // assigns straight through with no clamp.
  describe('cell_size', () => {
    it('accepts a typical value', () => {
      expect(check('cell_size', '1.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('cell_size', 'big')?.code).toBe('INVALID_CELL_SIZE_FORMAT');
    });

    it('accepts exactly the hinted floor', () => {
      expect(check('cell_size', '0.1')).toBeNull();
    });

    it('warns below the hinted floor, since the setter assigns straight through (root_motion_view.cpp:56-59)', () => {
      const result = check('cell_size', '0.05');
      expect(result?.code).toBe('INVALID_CELL_SIZE_VALUE');
      expect(result?.severity).toBe('warning');
    });

    it('accepts far above the hinted 16 ceiling, since the hint carries or_greater, which opens the max end', () => {
      expect(check('cell_size', '1000')).toBeNull();
    });
  });

  // root_motion_view.cpp:192: ADD_PROPERTY(PropertyInfo(Variant::FLOAT,
  // "radius", PROPERTY_HINT_RANGE, "0.1,16,0.01,or_greater,suffix:m"),
  // "set_radius", "get_radius"). set_radius (root_motion_view.cpp:65-68) assigns
  // straight through with no clamp — the same shape as cell_size.
  describe('radius', () => {
    it('accepts a typical value', () => {
      expect(check('radius', '10.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('radius', 'far')?.code).toBe('INVALID_RADIUS_FORMAT');
    });

    it('warns below the hinted floor, since the setter assigns straight through (root_motion_view.cpp:65-68)', () => {
      const result = check('radius', '0.05');
      expect(result?.code).toBe('INVALID_RADIUS_VALUE');
      expect(result?.severity).toBe('warning');
    });

    it('accepts far above the hinted 16 ceiling, since the hint carries or_greater, which opens the max end', () => {
      expect(check('radius', '1000')).toBeNull();
    });
  });

  // root_motion_view.cpp:193: ADD_PROPERTY(PropertyInfo(Variant::BOOL,
  // "zero_y"), "set_zero_y", "get_zero_y"); PROPERTY_HINT_NONE, and set_zero_y
  // (root_motion_view.cpp:74-76) assigns straight through.
  describe('zero_y', () => {
    it('accepts true', () => {
      expect(check('zero_y', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('zero_y', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('zero_y', 'maybe')?.code).toBe('INVALID_ZERO_Y_FORMAT');
    });
  });

  it('resolves layers through the VisualInstance3D base-walk', () => {
    expect(check('layers', '1')).toBeNull();
    expect(check('layers', 'not-a-mask')?.code).toBe('INVALID_LAYERS_FORMAT');
  });
});
