/**
 * AspectRatioContainer strict validators — format and range checks.
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
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('AspectRatioContainer', property);
  expect(validator, `no validator registered for AspectRatioContainer.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('AspectRatioContainer strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('AspectRatioContainer')).not.toEqual([]);
  });

  it('registers exactly the 4 own members from doc/classes/AspectRatioContainer.xml (no overrides=)', () => {
    expect(validatorRegistry.getOwnKeys('AspectRatioContainer').sort()).toEqual([
      'alignment_horizontal',
      'alignment_vertical',
      'ratio',
      'stretch_mode',
    ]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('AspectRatioContainer')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('ratio (float, min 0.001, open max)', () => {
    // aspect_ratio_container.cpp:188, PROPERTY_HINT_RANGE "0.001,10.0,0.0001,or_greater".
    // "or_greater" opens the max end, so only the 0.001 floor is grounded.
    // set_ratio (aspect_ratio_container.cpp:48-54) assigns unconditionally, no
    // ERR_FAIL, so the floor is a warning, not an error.
    it('accepts 1.0 (the documented default)', () => {
      expect(check('ratio', '1.0')).toBeNull();
    });

    it('accepts the hinted floor (0.001)', () => {
      expect(check('ratio', '0.001')).toBeNull();
    });

    it('accepts a value far past the hinted ceiling (or_greater leaves it open)', () => {
      expect(check('ratio', '10000.0')).toBeNull();
    });

    it('warns below the floor rather than erroring', () => {
      const error = check('ratio', '0.0');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('rejects a non-numeric value', () => {
      expect(check('ratio', 'wide')).not.toBeNull();
    });
  });

  describe('stretch_mode (enum 0-3)', () => {
    // aspect_ratio_container.cpp:189, PROPERTY_HINT_ENUM "Width Controls
    // Height,Height Controls Width,Fit,Cover", four labels, so 0-3.
    // set_stretch_mode (aspect_ratio_container.cpp:56-62) assigns
    // unconditionally, no ERR_FAIL, so an out-of-range value warns.
    it('accepts 0 (STRETCH_WIDTH_CONTROLS_HEIGHT)', () => {
      expect(check('stretch_mode', '0')).toBeNull();
    });

    it('accepts 1 (STRETCH_HEIGHT_CONTROLS_WIDTH)', () => {
      expect(check('stretch_mode', '1')).toBeNull();
    });

    it('accepts 2 (STRETCH_FIT, the documented default)', () => {
      expect(check('stretch_mode', '2')).toBeNull();
    });

    it('accepts 3 (STRETCH_COVER)', () => {
      expect(check('stretch_mode', '3')).toBeNull();
    });

    it('warns on a value beyond the enum (4) rather than erroring', () => {
      const error = check('stretch_mode', '4');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });

    it('warns on a negative value', () => {
      const error = check('stretch_mode', '-1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });
  });

  describe('alignment_horizontal (enum 0-2)', () => {
    // aspect_ratio_container.cpp:192, PROPERTY_HINT_ENUM "Begin,Center,End".
    // set_alignment_horizontal (aspect_ratio_container.cpp:64-70) assigns
    // unconditionally, no ERR_FAIL, so an out-of-range value warns.
    it('accepts 0 (ALIGNMENT_BEGIN)', () => {
      expect(check('alignment_horizontal', '0')).toBeNull();
    });

    it('accepts 1 (ALIGNMENT_CENTER, the documented default)', () => {
      expect(check('alignment_horizontal', '1')).toBeNull();
    });

    it('accepts 2 (ALIGNMENT_END)', () => {
      expect(check('alignment_horizontal', '2')).toBeNull();
    });

    it('warns on a value beyond the enum (3) rather than erroring', () => {
      const error = check('alignment_horizontal', '3');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });
  });

  describe('alignment_vertical (enum 0-2)', () => {
    // aspect_ratio_container.cpp:193, PROPERTY_HINT_ENUM "Begin,Center,End".
    // set_alignment_vertical (aspect_ratio_container.cpp:72-78) assigns
    // unconditionally, no ERR_FAIL, so an out-of-range value warns.
    it('accepts 0 (ALIGNMENT_BEGIN)', () => {
      expect(check('alignment_vertical', '0')).toBeNull();
    });

    it('accepts 1 (ALIGNMENT_CENTER, the documented default)', () => {
      expect(check('alignment_vertical', '1')).toBeNull();
    });

    it('accepts 2 (ALIGNMENT_END)', () => {
      expect(check('alignment_vertical', '2')).toBeNull();
    });

    it('warns on a negative value rather than erroring', () => {
      const error = check('alignment_vertical', '-1');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('warning');
    });
  });

  describe('inheritance through the base-walk', () => {
    it('resolves an inherited Control key (anchor_right) on AspectRatioContainer', () => {
      expect(check('anchor_right', '1.0')).toBeNull();
    });

    it('resolves an inherited CanvasItem key (modulate) on AspectRatioContainer', () => {
      expect(check('modulate', 'Color(1, 1, 1, 1)')).toBeNull();
    });
  });
});
