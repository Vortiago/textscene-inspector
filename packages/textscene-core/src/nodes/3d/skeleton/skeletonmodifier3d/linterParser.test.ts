/**
 * SkeletonModifier3D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry`, not through `Linter`: Linter pulls
 * `linter/index.ts`, the barrel that imports every slice, so a scoped run while
 * sibling slices are being written fails on their half-finished files. The
 * barrel path is covered by the full suite.
 *
 * Grow this into one case per property — happy, malformed, and any bound — and
 * quote the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('SkeletonModifier3D', property);
  expect(validator, `no validator registered for SkeletonModifier3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('SkeletonModifier3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('SkeletonModifier3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('SkeletonModifier3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('active', () => {
    it('accepts true', () => {
      expect(check('active', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('active', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('active', 'maybe');
      expect(error).not.toBeNull();
      expect(error?.message).toContain('active');
    });
  });

  describe('influence', () => {
    it('accepts the default 1.0', () => {
      expect(check('influence', '1.0')).toBeNull();
    });

    it('accepts the lower bound 0', () => {
      // scene/3d/skeleton_modifier_3d.cpp: ADD_PROPERTY(..., "influence", PROPERTY_HINT_RANGE, "0,1,0.001")
      expect(check('influence', '0')).toBeNull();
    });

    it('accepts the upper bound 1', () => {
      expect(check('influence', '1')).toBeNull();
    });

    it('accepts a mid-range value', () => {
      expect(check('influence', '0.5')).toBeNull();
    });

    it('accepts the value the unit fixture carries', () => {
      expect(check('influence', '0.75')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('influence', 'not-a-number');
      expect(error).not.toBeNull();
      expect(error?.message).toContain('influence');
    });

    it('rejects a value below 0', () => {
      const error = check('influence', '-0.1');
      expect(error).not.toBeNull();
      expect(error?.message).toContain('influence');
    });

    it('rejects a value above 1', () => {
      const error = check('influence', '1.1');
      expect(error).not.toBeNull();
      expect(error?.message).toContain('influence');
    });
  });
});
