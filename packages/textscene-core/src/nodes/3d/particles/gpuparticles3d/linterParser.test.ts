/**
 * GPUParticles3D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through the
 * `valid-gpuparticles3d-resources` rule.
 *
 * Assertions check `error?.code` rather than message text, per the property
 * error codes the `v` DSL auto-derives (`INVALID_<NAME>_FORMAT` /
 * `INVALID_<NAME>_VALUE`, or `_REFERENCE` for resource references).
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
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('GPUParticles3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('amount', () => {
    // gpu_particles_3d.cpp:821 hints "1,1000000,1,exp" — no or_greater, so
    // 1,000,000 is a real ceiling and `exp` is slider scaling, not a bound.
    // set_amount:76 opens `ERR_FAIL_COND_MSG(p_amount < 1, ...)`, so the floor is
    // an ERROR and the unenforced ceiling a WARNING (ADR-0032).
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
    // gpu_particles_3d.cpp:822, ADD_PROPERTY hints PROPERTY_HINT_RANGE
    // "0,1,0.0001" — no or_greater/or_less, so both ends are hint-only.
    // set_amount_ratio (:730-733) is `amount_ratio = p_ratio;`, a bare
    // assignment with no ERR_FAIL and no CLAMP, so exceeding either end
    // is a WARNING, not an error (ADR-0032).
    it('accepts the hint floor 0 and ceiling 1 (gpu_particles_3d.cpp:822)', () => {
      expect(check('amount_ratio', '0')).toBeNull();
      expect(check('amount_ratio', '1')).toBeNull();
    });

    it('accepts the real value scenes/fixtures/unit-gpu-particles-2d.tscn:21 writes for the sibling property', () => {
      // GPUParticles3D has no fixture of its own (it renders nothing yet);
      // GPUParticles2D's amount_ratio is the identical FLOAT format.
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

    // gpu_particles_3d.cpp:833, PROPERTY_HINT_RANGE "0,4294967295,1"
    // (0..UINT32_MAX, no or_greater/or_less). set_seed (:115-118) is
    // `seed = p_seed;` where p_seed is uint32_t — the bind layer coerces an
    // out-of-range Variant int rather than the setter refusing it, so both
    // ends are warnings (ADR-0032).
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
    // gpu_particles_3d.cpp:844, ADD_PROPERTY hints PROPERTY_HINT_ENUM with 4
    // labels. set_transform_align:629-630 opens with
    // `ERR_FAIL_INDEX(uint32_t(p_align), 4);` — the setter itself refuses,
    // so BOTH ends of 0-3 are enforced errors (ADR-0032), unlike every other
    // enum in this file.
    it('accepts every labelled value 0-3', () => {
      expect(check('transform_align', '0')).toBeNull();
      expect(check('transform_align', '1')).toBeNull();
      expect(check('transform_align', '2')).toBeNull();
      expect(check('transform_align', '3')).toBeNull();
    });

    it('accepts the real value scenes/demos/3d/physics_interpolation/bullet.tscn:69 writes (`transform_align = 1`)', () => {
      expect(check('transform_align', '1')).toBeNull();
    });

    it('rejects a non-numeric value (FORMAT branch, always an error)', () => {
      expect(check('transform_align', 'x')?.code).toBe('INVALID_TRANSFORM_ALIGN_FORMAT');
    });

    it('errors just above 3, which ERR_FAIL_INDEX(uint32_t(p_align), 4) refuses', () => {
      const error = check('transform_align', '4');
      expect(error?.code).toBe('INVALID_TRANSFORM_ALIGN_VALUE');
      expect(error?.severity).toBe('error');
    });

    it('errors below 0, which the uint32_t cast in ERR_FAIL_INDEX(uint32_t(p_align), 4) also refuses', () => {
      // A negative Variant int cast to uint32_t wraps to a huge unsigned
      // value, so ERR_FAIL_INDEX still trips — the floor is enforced too,
      // not merely the label list running out.
      const error = check('transform_align', '-1');
      expect(error?.code).toBe('INVALID_TRANSFORM_ALIGN_VALUE');
      expect(error?.severity).toBe('error');
    });
  });

  describe('draw_passes', () => {
    // gpu_particles_3d.cpp:851, ADD_PROPERTY hints PROPERTY_HINT_RANGE
    // "0,4,1" — the hint's OWN floor (0) disagrees with the setter.
    // set_draw_passes:265-266 opens `ERR_FAIL_COND(p_count < 1);`, refusing
    // 0 outright, so the real enforced floor is 1, not the hint's 0. The
    // ceiling MAX_DRAW_PASSES=4 only sizes the static draw_pass_N
    // properties `_bind_methods` registers (gpu_particles_3d.h:56) — no
    // ERR_FAIL_COND bounds it in the setter — so the ceiling is a warning.
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
    // gpu_particles_3d.cpp:853, PROPERTY_HINT_RESOURCE_TYPE "Mesh", for i in
    // 1..MAX_DRAW_PASSES. `_validate_property:462-467` hides draw_pass_N
    // above `draw_passes`, so raising the count exposes an index with no
    // valid default to diff against, and packed_scene.cpp always writes
    // it — as the literal `null` for the still-empty Ref<Mesh>.
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

    // `danglingResources.ts` reads a literal `null` as an empty slot, never as
    // a dangling reference; the FORMAT validator here accepts the spelling on
    // its own, so no pass routed through `findValidator` can reject it.
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
    // gpu_particles_3d.cpp:855, PROPERTY_HINT_RESOURCE_TYPE "Skin". Always
    // visible (no `_validate_property` conditioning, unlike draw_pass_N), so
    // a cleared skin diffs equal to the class default and packed_scene.cpp
    // OMITS it rather than writing `null` — no fixture in scenes/ carries
    // this key at all, consistent with that.
    it('accepts a SubResource reference (gpu_particles_3d.cpp:855)', () => {
      expect(check('draw_skin', 'SubResource("Skin_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('draw_skin', 'ExtResource("1")')).toBeNull();
    });

    it('accepts the literal null, which loads even though Godot omits a cleared skin', () => {
      // Whether the SERIALISER writes `null` is a separate question from whether
      // the loader takes one, and only the second decides what a file may hold.
      expect(check('draw_skin', 'null')).toBeNull();
    });

    it('rejects a value that is no reference at all', () => {
      expect(check('draw_skin', '"nope"')?.code).toBe('INVALID_DRAW_SKIN_REFERENCE');
    });
  });
});
