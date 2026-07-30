/**
 * SpringBoneCollision3D strict validators — format and range checks.
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
  const validator = validatorRegistry.findValidator('SpringBoneCollision3D', property);
  expect(validator, `no validator registered for SpringBoneCollision3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('SpringBoneCollision3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('SpringBoneCollision3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('SpringBoneCollision3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('bone_name', () => {
    it('accepts a quoted bone name', () => {
      expect(check('bone_name', '"Head"')).toBeNull();
    });

    // scene/3d/spring_bone_collision_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::STRING_NAME, "bone_name"), ...)
    // — Godot writes a StringName-typed property as `&"value"`, e.g. AnimationPlayer's
    // `autoplay = &"walk"` in the corpus, so that form must parse as valid too.
    it('accepts the StringName literal form &"..."', () => {
      expect(check('bone_name', '&"Head"')).toBeNull();
    });

    it('accepts the empty-string default (no bone selected)', () => {
      expect(check('bone_name', '""')).toBeNull();
    });

    it('rejects an unquoted value', () => {
      const error = check('bone_name', 'Head');
      expect(error).not.toBeNull();
      expect(error?.message).toContain('bone_name');
    });
  });

  describe('bone', () => {
    it('accepts the default -1 (no bone attached)', () => {
      expect(check('bone', '-1')).toBeNull();
    });

    it('accepts a positive bone index', () => {
      expect(check('bone', '3')).toBeNull();
    });

    // scene/3d/spring_bone_collision_3d.cpp: ADD_PROPERTY(..., "bone", PROPERTY_HINT_NONE, "", ...) — no
    // PROPERTY_HINT_RANGE at all, so the property system places no bound on it; anything below -1 is only
    // ever caught at runtime against a live Skeleton3D, which the static linter cannot see.
    it('accepts a value below -1 (no static bound to enforce)', () => {
      expect(check('bone', '-5')).toBeNull();
    });

    it('rejects a non-integer value', () => {
      const error = check('bone', 'not-an-index');
      expect(error).not.toBeNull();
      expect(error?.message).toContain('bone');
    });
  });

  describe('position_offset', () => {
    it('accepts a Vector3 literal', () => {
      expect(check('position_offset', 'Vector3(0, 0.1, 0)')).toBeNull();
    });

    it('accepts the zero vector', () => {
      expect(check('position_offset', 'Vector3(0, 0, 0)')).toBeNull();
    });

    it('rejects a malformed Vector3', () => {
      const error = check('position_offset', 'Vector3(0, 0)');
      expect(error).not.toBeNull();
      expect(error?.message).toContain('position_offset');
    });
  });

  describe('rotation_offset', () => {
    it('accepts a Quaternion literal', () => {
      expect(check('rotation_offset', 'Quaternion(0, 0, 0, 1)')).toBeNull();
    });

    it('rejects a malformed Quaternion', () => {
      const error = check('rotation_offset', 'Quaternion(0, 0, 0)');
      expect(error).not.toBeNull();
      expect(error?.message).toContain('rotation_offset');
    });
  });
});
