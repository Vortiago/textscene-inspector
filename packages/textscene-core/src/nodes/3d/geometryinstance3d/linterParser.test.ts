/**
 * GeometryInstance3D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('GeometryInstance3D', property);
  expect(validator, `no validator registered for GeometryInstance3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('GeometryInstance3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('GeometryInstance3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases follow.
    const accepted = validatorRegistry
      .getOwnKeys('GeometryInstance3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('cast_shadow', () => {
    it('accepts every documented enum value (0-3)', () => {
      expect(check('cast_shadow', '0')).toBeNull();
      expect(check('cast_shadow', '1')).toBeNull();
      expect(check('cast_shadow', '2')).toBeNull();
      expect(check('cast_shadow', '3')).toBeNull();
    });

    it('rejects a value past SHADOWS_ONLY (3)', () => {
      expect(check('cast_shadow', '4')).not.toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('cast_shadow', '-1')).not.toBeNull();
    });
  });

  describe('custom_aabb', () => {
    it('accepts an AABB(x, y, z, w, h, d) literal', () => {
      expect(check('custom_aabb', 'AABB(-1, -1, -1, 2, 2, 2)')).toBeNull();
    });

    it('accepts the documented all-zero default', () => {
      expect(check('custom_aabb', 'AABB(0, 0, 0, 0, 0, 0)')).toBeNull();
    });

    it('rejects a Vector3 (wrong arity)', () => {
      expect(check('custom_aabb', 'Vector3(1, 1, 1)')).not.toBeNull();
    });
  });

  describe('extra_cull_margin', () => {
    it('accepts the documented default (0.0)', () => {
      expect(check('extra_cull_margin', '0.0')).toBeNull();
    });

    it('accepts the upper editor bound (16384)', () => {
      expect(check('extra_cull_margin', '16384')).toBeNull();
    });

    it('rejects a negative value — setter is ERR_FAIL_COND(p_margin < 0)', () => {
      expect(check('extra_cull_margin', '-0.01')).not.toBeNull();
    });

    it('rejects a value past the 16384 editor bound', () => {
      expect(check('extra_cull_margin', '16384.01')).not.toBeNull();
    });
  });

  describe('gi_lightmap_texel_scale', () => {
    it('accepts the documented default (1.0)', () => {
      expect(check('gi_lightmap_texel_scale', '1.0')).toBeNull();
    });

    it('accepts the hint floor (0.01)', () => {
      expect(check('gi_lightmap_texel_scale', '0.01')).toBeNull();
    });

    it('accepts a value past the soft "10" bound — hint carries or_greater', () => {
      expect(check('gi_lightmap_texel_scale', '500')).toBeNull();
    });

    it('rejects a value below the 0.01 floor', () => {
      expect(check('gi_lightmap_texel_scale', '0.001')).not.toBeNull();
    });
  });

  describe('gi_mode', () => {
    it('accepts every documented enum value (0-2)', () => {
      expect(check('gi_mode', '0')).toBeNull();
      expect(check('gi_mode', '1')).toBeNull();
      expect(check('gi_mode', '2')).toBeNull();
    });

    it('rejects a value past DYNAMIC (2)', () => {
      expect(check('gi_mode', '3')).not.toBeNull();
    });
  });

  describe('ignore_occlusion_culling', () => {
    it('accepts true and false', () => {
      expect(check('ignore_occlusion_culling', 'true')).toBeNull();
      expect(check('ignore_occlusion_culling', 'false')).toBeNull();
    });

    it('rejects a non-boolean token', () => {
      expect(check('ignore_occlusion_culling', '1')).not.toBeNull();
    });
  });

  describe('lod_bias', () => {
    it('accepts the documented default (1.0)', () => {
      expect(check('lod_bias', '1.0')).toBeNull();
    });

    it('accepts 0 — doc: "forces the mesh to its lowest level of detail", setter allows it', () => {
      expect(check('lod_bias', '0')).toBeNull();
    });

    it('accepts the upper editor bound (128)', () => {
      expect(check('lod_bias', '128')).toBeNull();
    });

    it('rejects a negative value — setter is ERR_FAIL_COND(p_bias < 0.0)', () => {
      expect(check('lod_bias', '-0.001')).not.toBeNull();
    });

    it('rejects a value past the 128 editor bound', () => {
      expect(check('lod_bias', '128.001')).not.toBeNull();
    });
  });

  describe('material_overlay', () => {
    it('accepts a SubResource reference', () => {
      expect(check('material_overlay', 'SubResource("StandardMaterial3D_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('material_overlay', 'ExtResource("1")')).toBeNull();
    });

    it('rejects a bare resource path string', () => {
      expect(check('material_overlay', '"res://mat.tres"')).not.toBeNull();
    });
  });

  describe('material_override', () => {
    it('accepts a SubResource reference', () => {
      expect(check('material_override', 'SubResource("StandardMaterial3D_2")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('material_override', 'ExtResource("2")')).toBeNull();
    });

    it('rejects a bare resource path string', () => {
      expect(check('material_override', '"res://mat.tres"')).not.toBeNull();
    });
  });

  describe('transparency', () => {
    it('accepts the documented default (0.0) and the fully-transparent bound (1.0)', () => {
      expect(check('transparency', '0.0')).toBeNull();
      expect(check('transparency', '1.0')).toBeNull();
    });

    it('accepts a mid-range value', () => {
      expect(check('transparency', '0.25')).toBeNull();
    });

    it('rejects a negative value', () => {
      expect(check('transparency', '-0.01')).not.toBeNull();
    });

    it('rejects a value past 1.0', () => {
      expect(check('transparency', '1.01')).not.toBeNull();
    });
  });

  describe.each([
    'visibility_range_begin',
    'visibility_range_begin_margin',
    'visibility_range_end',
    'visibility_range_end_margin',
  ])('%s', (property) => {
    it('accepts the documented default (0.0)', () => {
      expect(check(property, '0.0')).toBeNull();
    });

    it('accepts a value past the soft "4096" bound — hint carries or_greater', () => {
      expect(check(property, '9999')).toBeNull();
    });

    it('rejects a negative value — the range check has no "or_lesser" counterpart', () => {
      expect(check(property, '-0.01')).not.toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check(property, 'far')).not.toBeNull();
    });
  });

  describe('visibility_range_fade_mode', () => {
    it('accepts every documented enum value (0-2)', () => {
      expect(check('visibility_range_fade_mode', '0')).toBeNull();
      expect(check('visibility_range_fade_mode', '1')).toBeNull();
      expect(check('visibility_range_fade_mode', '2')).toBeNull();
    });

    it('rejects a value past DEPENDENCIES (2)', () => {
      expect(check('visibility_range_fade_mode', '3')).not.toBeNull();
    });
  });

  describe('sorting_offset', () => {
    it('accepts the documented default (0.0)', () => {
      expect(check('sorting_offset', '0.0')).toBeNull();
    });

    it('accepts a negative value — no hint range restores usage, so none is enforced', () => {
      expect(check('sorting_offset', '-5.0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('sorting_offset', 'near')).not.toBeNull();
    });
  });

  describe('sorting_use_aabb_center', () => {
    it('accepts the documented default (true) and the non-default (false)', () => {
      expect(check('sorting_use_aabb_center', 'true')).toBeNull();
      expect(check('sorting_use_aabb_center', 'false')).toBeNull();
    });

    it('rejects a non-boolean token', () => {
      expect(check('sorting_use_aabb_center', '0')).not.toBeNull();
    });
  });
});
