/**
 * GPUParticles3D strict validators, asserted through `validatorRegistry` so a
 * failure points at the validator rather than at scene parsing. Assertions read
 * the `v` DSL's `error?.code` (`INVALID_<NAME>_FORMAT`, `_VALUE` or `_REFERENCE`).
 * Rule-level behaviour belongs in linter.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('GPUParticles3D', property);
  expect(validator, `no validator registered for GPUParticles3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('GPUParticles3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('GPUParticles3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format.
    const accepted = validatorRegistry
      .getOwnKeys('GPUParticles3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('amount', () => {
    // gpu_particles_3d.cpp:821 hints "1,1000000,1,exp", where `exp` is slider scaling.
    // set_amount:76 refuses p_amount < 1, so the floor errors and the unenforced
    // ceiling warns (ADR-0032).
    it('accepts the enforced floor 1 and the hinted ceiling 1000000', () => {
      expect(check('amount', '1')).toBeNull();
      expect(check('amount', '1000000')).toBeNull();
    });

    it('accepts 200, the value scenes/fixtures/unit-gpuparticles3d.tscn:34 writes', () => {
      expect(check('amount', '200')).toBeNull();
    });

    it('rejects a non-numeric value (FORMAT branch, always an error)', () => {
      expect(check('amount', 'many')?.code).toBe('INVALID_AMOUNT_FORMAT');
    });

    it('errors at 0, one step below the floor ERR_FAIL_COND_MSG(p_amount < 1) refuses', () => {
      const error = check('amount', '0');
      expect(error?.code).toBe('INVALID_AMOUNT_VALUE');
      expect(error?.severity).toBe('error');
    });

    it('warns at 1000001, one step above the hint-only ceiling no setter guard bounds', () => {
      const warning = check('amount', '1000001');
      expect(warning?.code).toBe('INVALID_AMOUNT_VALUE');
      expect(warning?.severity).toBe('warning');
    });
  });

  describe('amount_ratio', () => {
    // gpu_particles_3d.cpp:822 hints "0,1,0.0001". set_amount_ratio (:730-733) is a bare
    // assignment, so either end only warns (ADR-0032).
    it('accepts the hint floor 0 and ceiling 1 (gpu_particles_3d.cpp:822)', () => {
      expect(check('amount_ratio', '0')).toBeNull();
      expect(check('amount_ratio', '1')).toBeNull();
    });

    it('accepts the real value scenes/fixtures/unit-gpu-particles-2d.tscn:21 writes for the sibling property', () => {
      // GPUParticles2D's amount_ratio has the identical FLOAT format.
      expect(check('amount_ratio', '0.8')).toBeNull();
    });

    it('rejects a non-numeric value (FORMAT branch, always an error)', () => {
      expect(check('amount_ratio', 'nope')?.code).toBe('INVALID_AMOUNT_RATIO_FORMAT');
    });

    it('warns just above the ceiling 1', () => {
      const warning = check('amount_ratio', '1.0001');
      expect(warning?.code).toBe('INVALID_AMOUNT_RATIO_VALUE');
      expect(warning?.severity).toBe('warning');
    });

    it('warns just below the floor 0', () => {
      const warning = check('amount_ratio', '-0.0001');
      expect(warning?.code).toBe('INVALID_AMOUNT_RATIO_VALUE');
      expect(warning?.severity).toBe('warning');
    });

    it('accepts nan — variant_parser.cpp:150-155 writes it and no comparison against NaN ever trips', () => {
      expect(check('amount_ratio', 'nan')).toBeNull();
    });

    it('warns (not errors) on inf, which trips the hinted ceiling like any other value above 1', () => {
      expect(check('amount_ratio', 'inf')?.severity).toBe('warning');
    });

    it('warns (not errors) on -inf / inf_neg, which trip the hinted floor', () => {
      expect(check('amount_ratio', '-inf')?.severity).toBe('warning');
      expect(check('amount_ratio', 'inf_neg')?.severity).toBe('warning');
    });
  });

  describe('use_fixed_seed / seed', () => {
    it('accepts true/false (ADD_PROPERTY(Variant::BOOL, "use_fixed_seed"), gpu_particles_3d.cpp:832)', () => {
      expect(check('use_fixed_seed', 'true')).toBeNull();
      expect(check('use_fixed_seed', 'false')).toBeNull();
      expect(check('use_fixed_seed', 'maybe')?.code).toBe('INVALID_USE_FIXED_SEED_FORMAT');
    });

    // gpu_particles_3d.cpp:833, PROPERTY_HINT_RANGE "0,4294967295,1". set_seed (:115-118)
    // takes a uint32_t, so the bind layer coerces an out-of-range int and both ends warn
    // (ADR-0032).
    it('accepts the hint floor 0 and ceiling UINT32_MAX (gpu_particles_3d.cpp:833)', () => {
      expect(check('seed', '0')).toBeNull();
      expect(check('seed', '4294967295')).toBeNull();
    });

    it('accepts a typical seed, the same integer format scenes/fixtures/unit-cpuparticles2d-curves.tscn:33 writes (`seed = 99`)', () => {
      expect(check('seed', '99')).toBeNull();
    });

    it('rejects a non-numeric seed (FORMAT branch, always an error)', () => {
      expect(check('seed', 'random')?.code).toBe('INVALID_SEED_FORMAT');
    });

    it('errors just above UINT32_MAX, where the slot drops the extra bit', () => {
      const warning = check('seed', '4294967296');
      expect(warning?.code).toBe('INVALID_SEED_VALUE');
      expect(warning?.severity).toBe('error');
    });

    it('takes -1, the uint32 spelling of the ceiling the hint names', () => {
      expect(check('seed', '-1')).toBeNull();
    });
  });

  describe('interpolate', () => {
    it('accepts true/false (ADD_PROPERTY(Variant::BOOL, "interpolate"), gpu_particles_3d.cpp:835)', () => {
      expect(check('interpolate', 'true')).toBeNull();
      expect(check('interpolate', 'false')).toBeNull();
      expect(check('interpolate', 'maybe')?.code).toBe('INVALID_INTERPOLATE_FORMAT');
    });

    it('accepts the real value scenes/demos/3d/particles/test.tscn:769 writes (`interpolate = false`)', () => {
      expect(check('interpolate', 'false')).toBeNull();
    });
  });

  describe('transform_align', () => {
    // 4.7.2's gpu_particles_3d.cpp:652-656 assigns bare, where 4.6.3's :629-630 refused
    // with `ERR_FAIL_INDEX(uint32_t(p_align), 4)`. The newer release wins, so only the
    // hint bounds this: 4.7.2's :894 lists five labels.
    it('accepts every labelled value 0-4, LOCAL_BILLBOARD included', () => {
      expect(check('transform_align', '0')).toBeNull();
      expect(check('transform_align', '1')).toBeNull();
      expect(check('transform_align', '2')).toBeNull();
      expect(check('transform_align', '3')).toBeNull();
      expect(check('transform_align', '4')).toBeNull();
    });

    it('accepts the real value scenes/demos/3d/physics_interpolation/bullet.tscn:69 writes (`transform_align = 1`)', () => {
      expect(check('transform_align', '1')).toBeNull();
    });

    it('rejects a non-numeric value (FORMAT branch, always an error)', () => {
      expect(check('transform_align', 'x')?.code).toBe('INVALID_TRANSFORM_ALIGN_FORMAT');
    });

    it('warns just above 4, where the hint label list runs out but no setter refuses', () => {
      const warning = check('transform_align', '5');
      expect(warning?.code).toBe('INVALID_TRANSFORM_ALIGN_VALUE');
      expect(warning?.severity).toBe('warning');
    });

    it('warns below 0, the same hint bound from the other end', () => {
      const warning = check('transform_align', '-1');
      expect(warning?.code).toBe('INVALID_TRANSFORM_ALIGN_VALUE');
      expect(warning?.severity).toBe('warning');
    });
  });

  describe('draw_passes', () => {
    // gpu_particles_3d.cpp:851 hints "0,4,1", but set_draw_passes:265-266 refuses
    // p_count < 1, so the enforced floor is 1. MAX_DRAW_PASSES=4 (gpu_particles_3d.h:56)
    // only sizes the draw_pass_N properties, so the ceiling warns.
    it('accepts the enforced floor 1 and hinted ceiling 4', () => {
      expect(check('draw_passes', '1')).toBeNull();
      expect(check('draw_passes', '4')).toBeNull();
    });

    it('accepts the real value scenes/demos/3d/particles/test.tscn:901 writes (`draw_passes = 2`)', () => {
      expect(check('draw_passes', '2')).toBeNull();
    });

    it('rejects a non-numeric value (FORMAT branch, always an error)', () => {
      expect(check('draw_passes', 'many')?.code).toBe('INVALID_DRAW_PASSES_FORMAT');
    });

    it('errors at 0, which ERR_FAIL_COND(p_count < 1) refuses — the hint says 0 is legal, the setter disagrees', () => {
      const error = check('draw_passes', '0');
      expect(error?.code).toBe('INVALID_DRAW_PASSES_VALUE');
      expect(error?.severity).toBe('error');
    });

    it('warns just above the hint-only ceiling of 4, which no setter guard bounds', () => {
      const warning = check('draw_passes', '5');
      expect(warning?.code).toBe('INVALID_DRAW_PASSES_VALUE');
      expect(warning?.severity).toBe('warning');
    });
  });

  describe('draw_pass_1..4', () => {
    // gpu_particles_3d.cpp:853, PROPERTY_HINT_RESOURCE_TYPE "Mesh". `_validate_property:462-467`
    // hides draw_pass_N above `draw_passes`, so packed_scene.cpp writes an exposed
    // empty pass as the literal `null`.
    it.each(['draw_pass_1', 'draw_pass_2', 'draw_pass_3', 'draw_pass_4'])(
      '%s accepts a SubResource reference',
      (property) => {
        expect(check(property, 'SubResource("Mesh_1")')).toBeNull();
      }
    );

    it.each(['draw_pass_1', 'draw_pass_2', 'draw_pass_3', 'draw_pass_4'])(
      '%s accepts an ExtResource reference',
      (property) => {
        expect(check(property, 'ExtResource("1")')).toBeNull();
      }
    );

    it('accepts the real value scenes/demos/3d/particles/test.tscn:902 writes (`draw_pass_1 = SubResource("TubeTrailMesh_slq55")`)', () => {
      expect(check('draw_pass_1', 'SubResource("TubeTrailMesh_slq55")')).toBeNull();
    });

    // `danglingResources.ts` reads a literal `null` as an empty slot, and the format
    // validator accepts it, so no pass through `findValidator` rejects it.
    it.each(['draw_pass_1', 'draw_pass_2', 'draw_pass_3', 'draw_pass_4'])(
      '%s accepts the literal null — the empty-pass spelling scenes/demos/3d/particles/test.tscn:903 ships (`draw_pass_2 = null`)',
      (property) => {
        expect(check(property, 'null')).toBeNull();
      }
    );

    it.each(['draw_pass_1', 'draw_pass_2', 'draw_pass_3', 'draw_pass_4'])(
      '%s rejects a non-reference, non-null value (always an error)',
      (property) => {
        expect(check(property, '"not-a-resource"')?.code).toBe(
          `INVALID_${property.toUpperCase()}_REFERENCE`
        );
      }
    );
  });

  describe('draw_skin', () => {
    // gpu_particles_3d.cpp:855, PROPERTY_HINT_RESOURCE_TYPE "Skin". Always visible, so a
    // cleared skin equals the class default and packed_scene.cpp omits it.
    it('accepts a SubResource reference (gpu_particles_3d.cpp:855)', () => {
      expect(check('draw_skin', 'SubResource("Skin_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('draw_skin', 'ExtResource("1")')).toBeNull();
    });

    it('accepts the literal null, which loads even though Godot omits a cleared skin', () => {
      // Only what the loader takes decides what a file may hold, not what the
      // serialiser writes.
      expect(check('draw_skin', 'null')).toBeNull();
    });

    it('rejects a value that is no reference at all', () => {
      expect(check('draw_skin', '"nope"')?.code).toBe('INVALID_DRAW_SKIN_REFERENCE');
    });
  });
});
