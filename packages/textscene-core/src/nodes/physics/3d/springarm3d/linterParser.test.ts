/**
 * SpringArm3D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. SpringArm3D registers no semantic rule, so there is no
 * linter.ts and nothing else to test.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('SpringArm3D', property);
  expect(validator, `no validator registered for SpringArm3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('SpringArm3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('SpringArm3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('SpringArm3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('collision_mask', () => {
    it('accepts the default (layer 1 only)', () => {
      expect(check('collision_mask', '1')).toBeNull();
    });

    it('accepts 0 (no layers)', () => {
      expect(check('collision_mask', '0')).toBeNull();
    });

    it('accepts the maximum 32-bit mask', () => {
      expect(check('collision_mask', '4294967295')).toBeNull();
    });

    it('rejects a value past the 32-bit mask as out of range, not malformed', () => {
      expect(check('collision_mask', '4294967296')?.code).toBe('INVALID_COLLISION_MASK_VALUE');
    });

    it('rejects a non-numeric value as malformed', () => {
      expect(check('collision_mask', 'all')?.code).toBe('INVALID_COLLISION_MASK_FORMAT');
    });
  });

  describe('shape', () => {
    it('accepts a SubResource reference', () => {
      expect(check('shape', 'SubResource("SphereShape3D_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('shape', 'ExtResource("1_abcde")')).toBeNull();
    });

    it('rejects a bare string', () => {
      const error = check('shape', '"not_a_reference"');
      expect(error).not.toBeNull();
      expect(error?.code).toBe('INVALID_SHAPE_REFERENCE');
    });
  });

  describe('spring_length', () => {
    it('accepts the default 1.0', () => {
      expect(check('spring_length', '1.0')).toBeNull();
    });

    it('accepts a larger extent', () => {
      expect(check('spring_length', '5.5')).toBeNull();
    });

    // scene/3d/physics/spring_arm_3d.cpp: ADD_PROPERTY(..., "spring_length", PROPERTY_HINT_NONE, "suffix:m") —
    // no PROPERTY_HINT_RANGE, so the property system places no bound on it; a negative
    // extent is only ever caught by the arm's own runtime cast, which the static linter can't see.
    it('accepts a negative value (no static bound to enforce)', () => {
      expect(check('spring_length', '-2')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('spring_length', 'far');
      expect(error).not.toBeNull();
      expect(error?.code).toBe('INVALID_SPRING_LENGTH_FORMAT');
    });
  });

  describe('margin', () => {
    it('accepts the default 0.01', () => {
      expect(check('margin', '0.01')).toBeNull();
    });

    it('accepts 0', () => {
      expect(check('margin', '0')).toBeNull();
    });

    // scene/3d/physics/spring_arm_3d.cpp: ADD_PROPERTY(..., "margin", PROPERTY_HINT_NONE, "suffix:m") —
    // no PROPERTY_HINT_RANGE, so no bound; same static-linter blind spot as spring_length.
    it('accepts a negative value (no static bound to enforce)', () => {
      expect(check('margin', '-0.5')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('margin', 'close');
      expect(error).not.toBeNull();
      expect(error?.code).toBe('INVALID_MARGIN_FORMAT');
    });
  });
});
