/**
 * GPUParticles2D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * Assertions check `error?.code` rather than message text, per the property
 * error codes the `v` DSL auto-derives (`INVALID_<NAME>_FORMAT` /
 * `INVALID_<NAME>_VALUE`, or `_REFERENCE` / `_PATH` for resource/NodePath).
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('GPUParticles2D', property);
  expect(validator, `no validator registered for GPUParticles2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('GPUParticles2D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('GPUParticles2D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('GPUParticles2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('does not register a validator for draw_order', () => {
    // set_draw_order (gpu_particles_2d.cpp:309) has no ERR_FAIL_INDEX or CLAMP,
    // exactly like CPUParticles2D's identically-named setter, which that
    // sibling slice deliberately leaves unvalidated.
    expect(validatorRegistry.findValidator('GPUParticles2D', 'draw_order')).toBeNull();
  });

  describe('booleans', () => {
    it.each([
      'emitting',
      'one_shot',
      'use_fixed_seed',
      'interpolate',
      'fract_delta',
      'local_coords',
      'trail_enabled',
    ])('%s accepts true/false and rejects anything else', (property) => {
      expect(check(property, 'true')).toBeNull();
      expect(check(property, 'false')).toBeNull();
      expect(check(property, 'maybe')?.code).toBe(`INVALID_${property.toUpperCase()}_FORMAT`);
    });
  });

  describe('amount', () => {
    // gpu_particles_2d.cpp:942 hints "1,1000000,1,exp" — hard 1..1000000.
    it('accepts a mid-range value', () => {
      expect(check('amount', '64')).toBeNull();
    });

    it('accepts the boundary values 1 and 1000000', () => {
      expect(check('amount', '1')).toBeNull();
      expect(check('amount', '1000000')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('amount', 'lots')?.code).toBe('INVALID_AMOUNT_FORMAT');
    });

    it('rejects 0, which set_amount ERR_FAILs', () => {
      expect(check('amount', '0')?.code).toBe('INVALID_AMOUNT_VALUE');
    });

    it('rejects above the hint ceiling', () => {
      expect(check('amount', '1000001')?.code).toBe('INVALID_AMOUNT_VALUE');
    });
  });

  describe('amount_ratio', () => {
    it('accepts values within 0..1', () => {
      expect(check('amount_ratio', '0.8')).toBeNull();
    });

    it('accepts the boundary values 0 and 1', () => {
      expect(check('amount_ratio', '0')).toBeNull();
      expect(check('amount_ratio', '1')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('amount_ratio', 'nope')?.code).toBe('INVALID_AMOUNT_RATIO_FORMAT');
    });

    it('rejects a value above 1', () => {
      expect(check('amount_ratio', '1.5')?.code).toBe('INVALID_AMOUNT_RATIO_VALUE');
    });

    it('rejects a negative value', () => {
      expect(check('amount_ratio', '-0.1')?.code).toBe('INVALID_AMOUNT_RATIO_VALUE');
    });
  });

  describe('sub_emitter', () => {
    it('accepts a NodePath literal', () => {
      expect(check('sub_emitter', 'NodePath("../Other")')).toBeNull();
    });

    it('accepts the empty NodePath (no sub-emitter)', () => {
      expect(check('sub_emitter', 'NodePath("")')).toBeNull();
    });

    it('rejects a bare string', () => {
      expect(check('sub_emitter', '"../Other"')?.code).toBe('INVALID_SUB_EMITTER_PATH');
    });
  });

  describe('texture', () => {
    it('accepts a SubResource reference', () => {
      expect(check('texture', 'SubResource("Tex_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('texture', 'ExtResource("1")')).toBeNull();
    });

    it('rejects a non-reference value', () => {
      expect(check('texture', '"not-a-resource"')?.code).toBe('INVALID_TEXTURE_REFERENCE');
    });
  });

  describe('lifetime', () => {
    // gpu_particles_2d.cpp:947 hints "0.01,600.0,0.01,or_greater,…" — 0.01 is
    // the hard floor, 600 is a soft `or_greater` ceiling (not capped).
    it('accepts a typical value', () => {
      expect(check('lifetime', '2.0')).toBeNull();
    });

    it('accepts a value far beyond the soft 600 ceiling', () => {
      expect(check('lifetime', '10000')).toBeNull();
    });

    it('accepts the floor value 0.01', () => {
      expect(check('lifetime', '0.01')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('lifetime', 'forever')?.code).toBe('INVALID_LIFETIME_FORMAT');
    });

    it('rejects below the hard floor', () => {
      expect(check('lifetime', '0.001')?.code).toBe('INVALID_LIFETIME_VALUE');
    });

    it('rejects zero', () => {
      expect(check('lifetime', '0')?.code).toBe('INVALID_LIFETIME_VALUE');
    });
  });

  describe('interp_to_end', () => {
    it('accepts values within 0..1', () => {
      expect(check('interp_to_end', '0.5')).toBeNull();
    });

    it('accepts the boundary values 0 and 1', () => {
      expect(check('interp_to_end', '0')).toBeNull();
      expect(check('interp_to_end', '1')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('interp_to_end', 'x')?.code).toBe('INVALID_INTERP_TO_END_FORMAT');
    });

    it('rejects above 1', () => {
      expect(check('interp_to_end', '1.5')?.code).toBe('INVALID_INTERP_TO_END_VALUE');
    });
  });

  describe('preprocess', () => {
    // gpu_particles_2d.cpp:950 hints "0.00,10.0,0.01,or_greater,…" — 0 is the
    // hard floor, 10 is a soft `or_greater` ceiling.
    it('accepts a typical value', () => {
      expect(check('preprocess', '1.2')).toBeNull();
    });

    it('accepts zero and values far past the soft 10 ceiling', () => {
      expect(check('preprocess', '0')).toBeNull();
      expect(check('preprocess', '500')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('preprocess', 'y')?.code).toBe('INVALID_PREPROCESS_FORMAT');
    });

    it('rejects a negative value', () => {
      expect(check('preprocess', '-1')?.code).toBe('INVALID_PREPROCESS_VALUE');
    });
  });

  describe('speed_scale', () => {
    // gpu_particles_2d.cpp:951 hints "0,64,0.01" — no or_greater/or_less, hard
    // both ends.
    it('accepts a typical value', () => {
      expect(check('speed_scale', '1.0')).toBeNull();
    });

    it('accepts the boundary values 0 and 64', () => {
      expect(check('speed_scale', '0')).toBeNull();
      expect(check('speed_scale', '64')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('speed_scale', 'z')?.code).toBe('INVALID_SPEED_SCALE_FORMAT');
    });

    it('rejects above the hard ceiling', () => {
      expect(check('speed_scale', '64.5')?.code).toBe('INVALID_SPEED_SCALE_VALUE');
    });

    it('rejects a negative value', () => {
      expect(check('speed_scale', '-1')?.code).toBe('INVALID_SPEED_SCALE_VALUE');
    });
  });

  describe('explosiveness and randomness', () => {
    it.each(['explosiveness', 'randomness'])('%s accepts 0..1 and rejects outside it', (property) => {
      expect(check(property, '0.5')).toBeNull();
      expect(check(property, '0')).toBeNull();
      expect(check(property, '1')).toBeNull();
      expect(check(property, 'n')?.code).toBe(`INVALID_${property.toUpperCase()}_FORMAT`);
      expect(check(property, '1.1')?.code).toBe(`INVALID_${property.toUpperCase()}_VALUE`);
    });
  });

  describe('seed', () => {
    // gpu_particles_2d.cpp:955 hints "0,4294967295,1" (0..UINT32_MAX).
    it('accepts a typical value', () => {
      expect(check('seed', '4242')).toBeNull();
    });

    it('accepts the boundary values 0 and 4294967295', () => {
      expect(check('seed', '0')).toBeNull();
      expect(check('seed', '4294967295')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('seed', 'random')?.code).toBe('INVALID_SEED_FORMAT');
    });

    it('rejects a negative value', () => {
      expect(check('seed', '-1')?.code).toBe('INVALID_SEED_VALUE');
    });

    it('rejects above UINT32_MAX', () => {
      expect(check('seed', '4294967296')?.code).toBe('INVALID_SEED_VALUE');
    });
  });

  describe('fixed_fps', () => {
    // gpu_particles_2d.cpp:956 hints "0,1000,1,suffix:FPS" — hard both ends.
    it('accepts a typical value', () => {
      expect(check('fixed_fps', '30')).toBeNull();
    });

    it('accepts the boundary values 0 and 1000', () => {
      expect(check('fixed_fps', '0')).toBeNull();
      expect(check('fixed_fps', '1000')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('fixed_fps', 'fast')?.code).toBe('INVALID_FIXED_FPS_FORMAT');
    });

    it('rejects above the hard ceiling', () => {
      expect(check('fixed_fps', '1001')?.code).toBe('INVALID_FIXED_FPS_VALUE');
    });
  });

  describe('collision_base_size', () => {
    // gpu_particles_2d.cpp:960 hints "0,128,0.01,or_greater" — 0 is the hard
    // floor, 128 is a soft `or_greater` ceiling.
    it('accepts a typical value', () => {
      expect(check('collision_base_size', '1.0')).toBeNull();
    });

    it('accepts zero and values far past the soft 128 ceiling', () => {
      expect(check('collision_base_size', '0')).toBeNull();
      expect(check('collision_base_size', '5000')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('collision_base_size', 'w')?.code).toBe('INVALID_COLLISION_BASE_SIZE_FORMAT');
    });

    it('rejects a negative value', () => {
      expect(check('collision_base_size', '-0.1')?.code).toBe('INVALID_COLLISION_BASE_SIZE_VALUE');
    });
  });

  describe('visibility_rect', () => {
    // gpu_particles_2d.cpp:962, PROPERTY_HINT_NONE — format only, no range.
    it('accepts a Rect2 literal', () => {
      expect(check('visibility_rect', 'Rect2(-100, -100, 200, 200)')).toBeNull();
    });

    it('accepts a Rect2 literal with negative width/height', () => {
      expect(check('visibility_rect', 'Rect2(0, 0, -50, -50)')).toBeNull();
    });

    it('rejects a malformed value', () => {
      expect(check('visibility_rect', 'Rect2(0, 0)')?.code).toBe('INVALID_VISIBILITY_RECT_FORMAT');
    });
  });

  describe('trails', () => {
    it('accepts a typical trail_lifetime and rejects below the hard 0.01 floor', () => {
      // gpu_particles_2d.cpp:967 hints "0.01,10,0.01,or_greater,…".
      expect(check('trail_lifetime', '0.3')).toBeNull();
      expect(check('trail_lifetime', '0.01')).toBeNull();
      expect(check('trail_lifetime', '50')).toBeNull(); // soft or_greater ceiling
      expect(check('trail_lifetime', 't')?.code).toBe('INVALID_TRAIL_LIFETIME_FORMAT');
      expect(check('trail_lifetime', '0.001')?.code).toBe('INVALID_TRAIL_LIFETIME_VALUE');
    });

    it('accepts trail_sections within 2..128 and rejects outside it', () => {
      // gpu_particles_2d.cpp:968 hints "2,128,1" — hard both ends.
      expect(check('trail_sections', '8')).toBeNull();
      expect(check('trail_sections', '2')).toBeNull();
      expect(check('trail_sections', '128')).toBeNull();
      expect(check('trail_sections', 's')?.code).toBe('INVALID_TRAIL_SECTIONS_FORMAT');
      expect(check('trail_sections', '1')?.code).toBe('INVALID_TRAIL_SECTIONS_VALUE');
      expect(check('trail_sections', '129')?.code).toBe('INVALID_TRAIL_SECTIONS_VALUE');
    });

    it('accepts trail_section_subdivisions within 1..1024 and rejects outside it', () => {
      // gpu_particles_2d.cpp:969 hints "1,1024,1" — hard both ends.
      expect(check('trail_section_subdivisions', '4')).toBeNull();
      expect(check('trail_section_subdivisions', '1')).toBeNull();
      expect(check('trail_section_subdivisions', '1024')).toBeNull();
      expect(check('trail_section_subdivisions', 'd')?.code).toBe(
        'INVALID_TRAIL_SECTION_SUBDIVISIONS_FORMAT'
      );
      expect(check('trail_section_subdivisions', '0')?.code).toBe(
        'INVALID_TRAIL_SECTION_SUBDIVISIONS_VALUE'
      );
      expect(check('trail_section_subdivisions', '1025')?.code).toBe(
        'INVALID_TRAIL_SECTION_SUBDIVISIONS_VALUE'
      );
    });
  });

  describe('process_material', () => {
    it('accepts a SubResource reference', () => {
      expect(check('process_material', 'SubResource("Process_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('process_material', 'ExtResource("1")')).toBeNull();
    });

    it('rejects a non-reference value', () => {
      expect(check('process_material', 'null')?.code).toBe('INVALID_PROCESS_MATERIAL_REFERENCE');
    });
  });
});
