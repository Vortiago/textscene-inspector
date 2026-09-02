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

  describe('draw_order', () => {
    // gpu_particles_2d.cpp:964, ADD_PROPERTY hints PROPERTY_HINT_ENUM
    // "Index,Lifetime,Reverse Lifetime" (enum 0-2). set_draw_order
    // (gpu_particles_2d.cpp:308-311) is `draw_order = p_order;` — no
    // ERR_FAIL_INDEX and no CLAMP — so out of range is a WARNING, not an
    // error (ADR-0032).
    it('accepts every labelled value 0-2 (gpu_particles_2d.cpp:964)', () => {
      expect(check('draw_order', '0')).toBeNull();
      expect(check('draw_order', '1')).toBeNull();
      expect(check('draw_order', '2')).toBeNull();
    });

    it('accepts the real value scenes/fixtures/unit-gpu-particles-2d.tscn:37 writes (`draw_order = 1`)', () => {
      expect(check('draw_order', '1')).toBeNull();
    });

    it('rejects a non-numeric value (FORMAT branch, always an error)', () => {
      expect(check('draw_order', 'z')?.code).toBe('INVALID_DRAW_ORDER_FORMAT');
    });

    it('warns just above 2, which set_draw_order does not ERR_FAIL_INDEX', () => {
      expect(check('draw_order', '3')?.severity).toBe('warning');
    });

    it('warns just below 0', () => {
      expect(check('draw_order', '-1')?.severity).toBe('warning');
    });

    it('warns (not errors) on the value CPUParticles2D\'s platformer demo ships for the identically-named property', () => {
      // enemy.tscn:296 is a CPUParticles2D node, not GPUParticles2D — no
      // GPUParticles2D fixture carries an out-of-range draw_order — but the
      // same reasoning applies: the setter has no guard, so any int format-
      // validates and only a warning follows.
      const warning = check('draw_order', '215832976');
      expect(warning?.code).toBe('INVALID_DRAW_ORDER_VALUE');
      expect(warning?.severity).toBe('warning');
    });
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
    // gpu_particles_2d.cpp:942 hints "1,1000000,1,exp"; set_amount
    // (gpu_particles_2d.cpp:71-72) ERR_FAILs below 1, enforcing the floor as
    // an error, but never enforces the 1000000 ceiling — that end is a
    // hint-only warning (ADR-0032).
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

    it('rejects 0 as an error, which set_amount ERR_FAILs', () => {
      const error = check('amount', '0');
      expect(error?.code).toBe('INVALID_AMOUNT_VALUE');
      expect(error?.severity).toBe('error');
    });

    it('warns (not errors) above the hint-only ceiling', () => {
      const warning = check('amount', '1000001');
      expect(warning?.code).toBe('INVALID_AMOUNT_VALUE');
      expect(warning?.severity).toBe('warning');
    });
  });

  describe('amount_ratio', () => {
    // gpu_particles_2d.cpp:943 hints "0,1,0.0001"; set_amount_ratio
    // (gpu_particles_2d.cpp:484-486) assigns unconditionally, so out of
    // range is a warning, not an error (ADR-0032).
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

    it('warns (not errors) above 1', () => {
      const warning = check('amount_ratio', '1.5');
      expect(warning?.code).toBe('INVALID_AMOUNT_RATIO_VALUE');
      expect(warning?.severity).toBe('warning');
    });

    it('warns (not errors) on a negative value', () => {
      expect(check('amount_ratio', '-0.1')?.severity).toBe('warning');
    });
  });

  describe('sub_emitter', () => {
    it('accepts a NodePath literal', () => {
      expect(check('sub_emitter', 'NodePath("../Other")')).toBeNull();
    });

    it('accepts the empty NodePath (no sub-emitter)', () => {
      expect(check('sub_emitter', 'NodePath("")')).toBeNull();
    });

    // variant.cpp:746-749 lists STRING (not STRING_NAME) as a strict source for NODE_PATH.
    it('takes the bare string the slot converts and rejects a StringName', () => {
      expect(check('sub_emitter', '"../Other"')).toBeNull();
      expect(check('sub_emitter', '&"../Other"')?.code).toBe('INVALID_SUB_EMITTER_PATH');
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
    // gpu_particles_2d.cpp:947 hints "0.01,600.0,0.01,or_greater,…", but
    // set_lifetime (gpu_particles_2d.cpp:78) ERR_FAILs only at `<= 0` —
    // the setter, not the hint, governs (ADR-0032), so 0.001 is legal.
    it('accepts a typical value', () => {
      expect(check('lifetime', '2.0')).toBeNull();
    });

    it('accepts a value far beyond the soft 600 ceiling', () => {
      expect(check('lifetime', '10000')).toBeNull();
    });

    it('accepts the hint floor value 0.01', () => {
      expect(check('lifetime', '0.01')).toBeNull();
    });

    it('warns below the hint floor, which the setter does not reject', () => {
      const warning = check('lifetime', '0.001');
      expect(warning?.severity).toBe('warning');
      expect(warning?.message).toContain('0.01');
    });

    it('rejects a non-numeric value', () => {
      expect(check('lifetime', 'forever')?.code).toBe('INVALID_LIFETIME_FORMAT');
    });

    it('rejects zero as an error, which set_lifetime ERR_FAILs', () => {
      const error = check('lifetime', '0');
      expect(error?.code).toBe('INVALID_LIFETIME_VALUE');
      expect(error?.severity).toBe('error');
    });

    it('rejects a negative value as an error', () => {
      expect(check('lifetime', '-1')?.code).toBe('INVALID_LIFETIME_VALUE');
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

    it('rejects above 1 as an error, which set_interp_to_end CLAMPs (gpu_particles_2d.cpp:210-211)', () => {
      const error = check('interp_to_end', '1.5');
      expect(error?.code).toBe('INVALID_INTERP_TO_END_VALUE');
      expect(error?.severity).toBe('error');
    });
  });

  describe('preprocess', () => {
    // gpu_particles_2d.cpp:950 hints "0.00,10.0,0.01,or_greater,…" — 0 is the
    // hard floor, 10 is a soft `or_greater` ceiling. set_pre_process_time
    // (gpu_particles_2d.cpp:99-101) assigns unconditionally, so the floor is
    // a warning (ADR-0032).
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

    it('warns (not errors) on a negative value', () => {
      const warning = check('preprocess', '-1');
      expect(warning?.code).toBe('INVALID_PREPROCESS_VALUE');
      expect(warning?.severity).toBe('warning');
    });
  });

  describe('speed_scale', () => {
    // gpu_particles_2d.cpp:951 hints "0,64,0.01" — no or_greater/or_less, hard
    // both ends. set_speed_scale (gpu_particles_2d.cpp:252-254) assigns
    // unconditionally, so out of range is a warning (ADR-0032).
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

    it('warns (not errors) above the hint ceiling', () => {
      const warning = check('speed_scale', '64.5');
      expect(warning?.code).toBe('INVALID_SPEED_SCALE_VALUE');
      expect(warning?.severity).toBe('warning');
    });

    it('warns (not errors) on a negative value', () => {
      expect(check('speed_scale', '-1')?.severity).toBe('warning');
    });
  });

  describe('explosiveness and randomness', () => {
    // gpu_particles_2d.cpp:952-953 hint "0,1,0.01"; set_explosiveness_ratio
    // (gpu_particles_2d.cpp:104-106) and set_randomness_ratio
    // (gpu_particles_2d.cpp:109-111) both assign unconditionally, so out of
    // range is a warning.
    it.each(['explosiveness', 'randomness'])('%s accepts 0..1 and warns outside it', (property) => {
      expect(check(property, '0.5')).toBeNull();
      expect(check(property, '0')).toBeNull();
      expect(check(property, '1')).toBeNull();
      expect(check(property, 'n')?.code).toBe(`INVALID_${property.toUpperCase()}_FORMAT`);
      const outOfRange = check(property, '1.1');
      expect(outOfRange?.code).toBe(`INVALID_${property.toUpperCase()}_VALUE`);
      expect(outOfRange?.severity).toBe('warning');
    });
  });

  describe('seed', () => {
    // gpu_particles_2d.cpp:955 hints "0,4294967295,1" (0..UINT32_MAX); set_seed
    // (gpu_particles_2d.cpp:360-362) assigns unconditionally — the uint32_t
    // param coerces rather than rejects, so out of range is a warning.
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

    it('takes -1, which is uint32 for the ceiling the hint already names', () => {
      expect(check('seed', '-1')).toBeNull();
    });

    it('errors above UINT32_MAX, where the slot drops the extra bit', () => {
      const warning = check('seed', '4294967296');
      expect(warning?.code).toBe('INVALID_SEED_VALUE');
      expect(warning?.severity).toBe('error');
    });
  });

  describe('fixed_fps', () => {
    // gpu_particles_2d.cpp:956 hints "0,1000,1,suffix:FPS" — hard both ends.
    // set_fixed_fps (gpu_particles_2d.cpp:317-319) assigns unconditionally,
    // so out of range is a warning.
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

    it('warns (not errors) above the hint ceiling', () => {
      const warning = check('fixed_fps', '1001');
      expect(warning?.code).toBe('INVALID_FIXED_FPS_VALUE');
      expect(warning?.severity).toBe('warning');
    });
  });

  describe('collision_base_size', () => {
    // gpu_particles_2d.cpp:960 hints "0,128,0.01,or_greater" — 0 is the hard
    // floor, 128 is a soft `or_greater` ceiling. set_collision_base_size
    // (gpu_particles_2d.cpp:243-246) assigns unconditionally, so the floor
    // is a warning.
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

    it('warns (not errors) on a negative value', () => {
      const warning = check('collision_base_size', '-0.1');
      expect(warning?.code).toBe('INVALID_COLLISION_BASE_SIZE_VALUE');
      expect(warning?.severity).toBe('warning');
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
    it('accepts a typical trail_lifetime and errors below the hard 0.01 floor', () => {
      // gpu_particles_2d.cpp:967 hints "0.01,10,0.01,or_greater,…";
      // set_trail_lifetime (gpu_particles_2d.cpp:187-188) ERR_FAILs below
      // `0.01 - CMP_EPSILON`, so the floor is an enforced error.
      expect(check('trail_lifetime', '0.3')).toBeNull();
      expect(check('trail_lifetime', '0.01')).toBeNull();
      expect(check('trail_lifetime', '50')).toBeNull(); // soft or_greater ceiling
      expect(check('trail_lifetime', 't')?.code).toBe('INVALID_TRAIL_LIFETIME_FORMAT');
      const belowFloor = check('trail_lifetime', '0.001');
      expect(belowFloor?.code).toBe('INVALID_TRAIL_LIFETIME_VALUE');
      expect(belowFloor?.severity).toBe('error');
    });

    it('accepts trail_sections within 2..128 and errors outside it', () => {
      // gpu_particles_2d.cpp:968 hints "2,128,1" — hard both ends;
      // set_trail_sections (gpu_particles_2d.cpp:194-197) ERR_FAILs outside
      // [2, 128], so both ends are enforced errors.
      expect(check('trail_sections', '8')).toBeNull();
      expect(check('trail_sections', '2')).toBeNull();
      expect(check('trail_sections', '128')).toBeNull();
      expect(check('trail_sections', 's')?.code).toBe('INVALID_TRAIL_SECTIONS_FORMAT');
      const belowMin = check('trail_sections', '1');
      expect(belowMin?.code).toBe('INVALID_TRAIL_SECTIONS_VALUE');
      expect(belowMin?.severity).toBe('error');
      expect(check('trail_sections', '129')?.severity).toBe('error');
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

    it('accepts the literal null, a cleared slot Godot loads', () => {
      expect(check('process_material', 'null')).toBeNull();
    });

    it('rejects a non-reference value', () => {
      expect(check('process_material', '"nope"')?.code).toBe('INVALID_PROCESS_MATERIAL_REFERENCE');
    });
  });
});
