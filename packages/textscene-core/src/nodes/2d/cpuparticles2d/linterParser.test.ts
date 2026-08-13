/**
 * CPUParticles2D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level/integration behaviour belongs in linter.test.ts,
 * through `Linter`.
 *
 * Assertions check `error?.code` rather than message text, per the property
 * error codes the `v` DSL auto-derives (`INVALID_<NAME>_FORMAT` /
 * `INVALID_<NAME>_VALUE`).
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('CPUParticles2D', property);
  expect(validator, `no validator registered for CPUParticles2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('CPUParticles2D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('CPUParticles2D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('CPUParticles2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('lifetime', () => {
    // set_lifetime (cpu_particles_2d.cpp:86) ERR_FAIL_COND_MSGs at `<= 0`,
    // while the hint (:1495, "0.01,600.0,0.01,or_greater,exp,suffix:s") floors
    // at 0.01 and opens the ceiling.
    it('errors at or below the floor the setter refuses', () => {
      expect(check('lifetime', '0')?.severity).toBe('error');
      expect(check('lifetime', '-1')?.severity).toBe('error');
    });

    it('warns between the refused floor and the hinted one', () => {
      const warning = check('lifetime', '0.005');
      expect(warning?.severity).toBe('warning');
      expect(warning?.message).toContain('0.01');
    });

    it('accepts the hint floor and anything past the open ceiling', () => {
      expect(check('lifetime', '0.01')).toBeNull();
      expect(check('lifetime', '99999')).toBeNull();
    });
  });

  describe('draw_order', () => {
    // cpu_particles_2d.cpp:1509, ADD_PROPERTY hints PROPERTY_HINT_ENUM
    // "Index,Lifetime" (enum 0-1). set_draw_order (cpu_particles_2d.cpp:
    // 173-175) is `draw_order = p_order;` — no ERR_FAIL_INDEX and no CLAMP —
    // so out of range is a WARNING, not an error (ADR-0032).
    it('accepts every labelled value 0-1 (cpu_particles_2d.cpp:1509)', () => {
      expect(check('draw_order', '0')).toBeNull();
      expect(check('draw_order', '1')).toBeNull();
    });

    it('accepts 1 (Lifetime) — no CPUParticles2D fixture in scenes/ writes an in-range value; the only real one is the out-of-range demo below', () => {
      expect(check('draw_order', '1')).toBeNull();
    });

    it('rejects a non-numeric value (FORMAT branch, always an error)', () => {
      expect(check('draw_order', 'z')?.code).toBe('INVALID_DRAW_ORDER_FORMAT');
    });

    it('warns just above 1, which set_draw_order does not ERR_FAIL_INDEX', () => {
      expect(check('draw_order', '2')?.severity).toBe('warning');
    });

    it('warns just below 0', () => {
      expect(check('draw_order', '-1')?.severity).toBe('warning');
    });

    it('warns (not errors) on the value scenes/demos/2d/platformer/enemy/enemy.tscn:296 ships (`draw_order = 215832976`)', () => {
      // The value this whole slice's leniency exists for: the 2D platformer
      // demo's Explosion node (CPUParticles2D) ships it, Godot reads
      // anything but 1 as Index, and an error here would fail a scene the
      // engine opens without complaint.
      const warning = check('draw_order', '215832976');
      expect(warning?.code).toBe('INVALID_DRAW_ORDER_VALUE');
      expect(warning?.severity).toBe('warning');
    });

    it('is NOT the same enum as GPUParticles2D.draw_order, which accepts a third value (2) this one warns on', () => {
      // gpu_particles_2d.h:40-43 adds DRAW_ORDER_REVERSE_LIFETIME = 2;
      // CPUParticles2D's DrawOrder (cpu_particles_2d.h:43-45) has only Index
      // and Lifetime, so 2 is out of range here though GPUParticles2D accepts it.
      const warning = check('draw_order', '2');
      expect(warning?.severity).toBe('warning');
    });
  });

  describe('hue_variation_min / hue_variation_max', () => {
    // cpu_particles_2d.cpp:1646-1647 hint "-1,1,0.01" — closed both ends, no
    // or_greater/or_less. set_param_min/set_param_max (cpu_particles_2d.cpp:
    // 352, 367) ERR_FAIL_INDEX the Parameter enum only, never the value, so
    // out-of-hint is a WARNING. Both endpoints are probed from both sides:
    // a mid-range accept alone leaves the bound's location unpinned.
    it.each(['hue_variation_min', 'hue_variation_max'])('accepts both endpoints of %s', (prop) => {
      expect(check(prop, '-1')).toBeNull();
      expect(check(prop, '1')).toBeNull();
    });

    it.each(['hue_variation_min', 'hue_variation_max'])(
      'warns one hint step (0.01) past either endpoint of %s',
      (prop) => {
        expect(check(prop, '-1.01')?.severity).toBe('warning');
        expect(check(prop, '1.01')?.severity).toBe('warning');
      }
    );

    it('reports the VALUE code, not the FORMAT one, for an out-of-hint number', () => {
      expect(check('hue_variation_min', '2')?.code).toBe('INVALID_HUE_VARIATION_MIN_VALUE');
      expect(check('hue_variation_max', '2')?.code).toBe('INVALID_HUE_VARIATION_MAX_VALUE');
    });
  });

  describe('fixed_fps', () => {
    // cpu_particles_2d.cpp:1504 hints "0,1000,1,suffix:FPS" — no or_greater/
    // or_less, so both ends are closed and `suffix:FPS` is a unit, not a bound.
    // set_fixed_fps (cpu_particles_2d.cpp:283-285) is `fixed_fps = p_count;`,
    // so out of hint is a WARNING at both ends (ADR-0032). Both endpoints are
    // probed from both sides: the ceiling shipped unimplemented while the
    // comment quoted it.
    it('accepts both endpoints (0 and 1000)', () => {
      expect(check('fixed_fps', '0')).toBeNull();
      expect(check('fixed_fps', '1000')).toBeNull();
    });

    it('accepts 30, the value every scenes/fixtures CPUParticles2D writes', () => {
      expect(check('fixed_fps', '30')).toBeNull();
    });

    it('warns one hint step (1) past either endpoint', () => {
      expect(check('fixed_fps', '-1')?.severity).toBe('warning');
      expect(check('fixed_fps', '1001')?.severity).toBe('warning');
    });

    it('reports the VALUE code, not the FORMAT one, for an out-of-hint number', () => {
      expect(check('fixed_fps', '1001')?.code).toBe('INVALID_FIXED_FPS_VALUE');
    });

    it('rejects a non-numeric value (FORMAT branch, always an error)', () => {
      const error = check('fixed_fps', 'fast');
      expect(error?.code).toBe('INVALID_FIXED_FPS_FORMAT');
      expect(error?.severity).toBe('error');
    });
  });

  describe('emission_sphere_radius', () => {
    // cpu_particles_2d.cpp:1587 hints "0.01,128,0.01,suffix:px" — no
    // or_greater/or_less, so both ends are closed and `suffix:px` is a unit.
    // set_emission_sphere_radius (cpu_particles_2d.cpp:491-499) assigns
    // unconditionally, so out of hint is a WARNING at both ends (ADR-0032),
    // matching the CPUParticles3D twin. The floor shipped at 0 and the ceiling
    // shipped absent while the comment quoted both.
    it('accepts both endpoints (0.01 and 128)', () => {
      expect(check('emission_sphere_radius', '0.01')).toBeNull();
      expect(check('emission_sphere_radius', '128')).toBeNull();
    });

    it('accepts 16.0, the value scenes/fixtures/unit-cpuparticles2d.tscn:29 writes', () => {
      expect(check('emission_sphere_radius', '16.0')).toBeNull();
    });

    it('warns one hint step (0.01) past either endpoint', () => {
      expect(check('emission_sphere_radius', '0')?.severity).toBe('warning');
      expect(check('emission_sphere_radius', '128.01')?.severity).toBe('warning');
    });

    it('reports the VALUE code, not the FORMAT one, for an out-of-hint number', () => {
      expect(check('emission_sphere_radius', '128.01')?.code).toBe(
        'INVALID_EMISSION_SPHERE_RADIUS_VALUE'
      );
    });

    it('rejects a non-numeric value (FORMAT branch, always an error)', () => {
      const error = check('emission_sphere_radius', 'wide');
      expect(error?.code).toBe('INVALID_EMISSION_SPHERE_RADIUS_FORMAT');
      expect(error?.severity).toBe('error');
    });
  });

  describe('seed', () => {
    // cpu_particles_2d.cpp:1502 hints "0," + itos(UINT32_MAX) + ",1" — closed
    // both ends. set_seed (cpu_particles_2d.cpp:613) is `seed = p_seed;` on a
    // uint32_t param, which coerces rather than refuses, so both ends WARN.
    it('accepts both endpoints (0 and UINT32_MAX)', () => {
      expect(check('seed', '0')).toBeNull();
      expect(check('seed', '4294967295')).toBeNull();
    });

    it('accepts 4242, the value scenes/fixtures/unit-cpuparticles2d.tscn:25 writes', () => {
      expect(check('seed', '4242')).toBeNull();
    });

    it('warns one hint step (1) past either endpoint', () => {
      expect(check('seed', '-1')?.severity).toBe('warning');
      expect(check('seed', '4294967296')?.severity).toBe('warning');
    });

    it('reports the VALUE code, not the FORMAT one, for an out-of-hint number', () => {
      expect(check('seed', '4294967296')?.code).toBe('INVALID_SEED_VALUE');
    });

    it('rejects a fractional value (FORMAT branch, always an error)', () => {
      const error = check('seed', '4.5');
      expect(error?.code).toBe('INVALID_SEED_FORMAT');
      expect(error?.severity).toBe('error');
    });
  });

  describe('initial_velocity_min / initial_velocity_max', () => {
    // cpu_particles_2d.cpp:1602-1603 hint "0,1000,0.01,or_greater,suffix:px/s".
    // `or_greater` opens the CEILING, so only the floor is a bound and 1000 is
    // not one; `suffix:px/s` is a unit. Routed through set_param_min/
    // set_param_max (cpu_particles_2d.cpp:353, 368), whose ERR_FAIL_INDEX guards
    // the Parameter index and never the value, so the floor WARNS.
    it.each(['initial_velocity_min', 'initial_velocity_max'])(
      'accepts the floor 0 of %s',
      (prop) => {
        expect(check(prop, '0')).toBeNull();
      }
    );

    it('accepts the real values scenes/fixtures/unit-cpuparticles2d.tscn:33-34 write (90.0 / 150.0)', () => {
      expect(check('initial_velocity_min', '90.0')).toBeNull();
      expect(check('initial_velocity_max', '150.0')).toBeNull();
    });

    it.each(['initial_velocity_min', 'initial_velocity_max'])(
      'leaves the or_greater ceiling open on %s — 5000 is far past the hint top of 1000 and legal',
      (prop) => {
        expect(check(prop, '5000')).toBeNull();
      }
    );

    it.each(['initial_velocity_min', 'initial_velocity_max'])(
      'warns one hint step (0.01) below 0 on %s',
      (prop) => {
        const warning = check(prop, '-0.01');
        expect(warning?.code).toBe(`INVALID_${prop.toUpperCase()}_VALUE`);
        expect(warning?.severity).toBe('warning');
      }
    );

    it('rejects a non-numeric value (FORMAT branch, always an error)', () => {
      const error = check('initial_velocity_min', 'fast');
      expect(error?.code).toBe('INVALID_INITIAL_VELOCITY_MIN_FORMAT');
      expect(error?.severity).toBe('error');
    });
  });

  describe('anim_offset_min / anim_offset_max', () => {
    // cpu_particles_2d.cpp:1653-1654 hint "0,1,0.0001" — closed both ends, no
    // or_greater/or_less. The same index-only set_param_min/set_param_max guard
    // (:353, :368) leaves the value unchecked, so both ends WARN.
    it.each(['anim_offset_min', 'anim_offset_max'])('accepts both endpoints of %s', (prop) => {
      expect(check(prop, '0')).toBeNull();
      expect(check(prop, '1')).toBeNull();
    });

    it('accepts 1.0, the value scenes/demos/2d/particles/particles.tscn:64 writes for anim_offset_max', () => {
      expect(check('anim_offset_max', '1.0')).toBeNull();
    });

    it.each(['anim_offset_min', 'anim_offset_max'])(
      'warns one hint step (0.0001) past either endpoint of %s',
      (prop) => {
        expect(check(prop, '-0.0001')?.severity).toBe('warning');
        expect(check(prop, '1.0001')?.severity).toBe('warning');
      }
    );

    it('reports the VALUE code, not the FORMAT one, for an out-of-hint number', () => {
      expect(check('anim_offset_min', '2')?.code).toBe('INVALID_ANIM_OFFSET_MIN_VALUE');
      expect(check('anim_offset_max', '2')?.code).toBe('INVALID_ANIM_OFFSET_MAX_VALUE');
    });
  });

  describe('emission_colors', () => {
    // cpu_particles_2d.cpp:1591, PropertyInfo(Variant::PACKED_COLOR_ARRAY).
    // get_emission_colors (cpu_particles_2d.cpp:551-553) returns
    // `Vector<Color>`, so this is a genuine PackedColorArray — format-only,
    // no range, per `v.packedColorArray` (packedArrays.ts).
    it('accepts the RGBA quadruple format', () => {
      expect(check('emission_colors', 'PackedColorArray(1, 0, 0, 1, 0, 1, 0, 1)')).toBeNull();
    });

    it('accepts the real value scenes/fixtures/unit-cpu-particles-3d.tscn:36 writes for the identical PACKED_COLOR_ARRAY format', () => {
      // No scenes/ fixture carries emission_colors on a CPUParticles2D node
      // specifically; CPUParticles3D's ADD_PROPERTY at the same class family
      // uses the identical Vector<Color>-backed PackedColorArray wire format.
      expect(
        check('emission_colors', 'PackedColorArray(1, 1, 1, 1, 1, 0, 0, 1)')
      ).toBeNull();
    });

    it('accepts an empty PackedColorArray — Godot serialises a zero-length array this way', () => {
      expect(check('emission_colors', 'PackedColorArray()')).toBeNull();
    });

    it('accepts inf/-inf/inf_neg/nan components — legal TSCN float literals (variant_parser.cpp:150-155) the per-component grammar reads', () => {
      expect(check('emission_colors', 'PackedColorArray(inf, -inf, inf_neg, nan)')).toBeNull();
    });

    it('rejects a malformed value (FORMAT branch, always an error)', () => {
      expect(check('emission_colors', 'not-an-array')?.code).toBe(
        'INVALID_EMISSION_COLORS_FORMAT'
      );
    });

    it('rejects a non-numeric component', () => {
      expect(check('emission_colors', 'PackedColorArray(x, 0, 0, 1)')?.code).toBe(
        'INVALID_EMISSION_COLORS_FORMAT'
      );
    });
  });
});
