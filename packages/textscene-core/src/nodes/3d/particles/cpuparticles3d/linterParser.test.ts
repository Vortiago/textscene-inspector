/**
 * CPUParticles3D strict validators — format and range checks.
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
  const validator = validatorRegistry.findValidator('CPUParticles3D', property);
  expect(validator, `no validator registered for CPUParticles3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('CPUParticles3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('CPUParticles3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('CPUParticles3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  // cpu_particles_3d.cpp:1555-1556 — top-level (before any ADD_GROUP).
  describe('emitting / amount', () => {
    it('accepts a boolean emitting flag', () => {
      expect(check('emitting', 'true')).toBeNull();
      expect(check('emitting', 'false')).toBeNull();
    });

    it('rejects a non-boolean emitting value', () => {
      expect(check('emitting', 'maybe')?.code).toBe('INVALID_EMITTING_FORMAT');
    });

    it('bounds amount to 1-1000000 (PROPERTY_HINT_RANGE "1,1000000,1,exp", no or_greater/or_less)', () => {
      expect(check('amount', '1')).toBeNull();
      expect(check('amount', '1000000')).toBeNull();
      expect(check('amount', '0')?.code).toBe('INVALID_AMOUNT_VALUE');
      expect(check('amount', '1000001')?.code).toBe('INVALID_AMOUNT_VALUE');
      expect(check('amount', 'many')?.code).toBe('INVALID_AMOUNT_FORMAT');
    });
  });

  // cpu_particles_3d.cpp:1557-1560 — ADD_GROUP("Time", "").
  describe('Time group', () => {
    it('accepts lifetime at and above the hard floor, or_greater lifting the ceiling', () => {
      expect(check('lifetime', '0.01')).toBeNull();
      expect(check('lifetime', '99999')).toBeNull();
    });

    it('rejects lifetime below the hard floor', () => {
      expect(check('lifetime', '0')?.code).toBe('INVALID_LIFETIME_VALUE');
    });

    it('accepts a boolean one_shot', () => {
      expect(check('one_shot', 'true')).toBeNull();
    });

    it('rejects a negative preprocess (hard floor 0, or_greater lifts the ceiling)', () => {
      expect(check('preprocess', '0')).toBeNull();
      expect(check('preprocess', '99999')).toBeNull();
      expect(check('preprocess', '-0.1')?.code).toBe('INVALID_PREPROCESS_VALUE');
    });
  });

  // cpu_particles_3d.cpp:1562-1569 — top-level (between the Time and Drawing groups).
  describe('emission cadence and RNG group', () => {
    it('bounds speed_scale to 0-64 (PROPERTY_HINT_RANGE "0,64,0.01", hard both ends)', () => {
      expect(check('speed_scale', '0')).toBeNull();
      expect(check('speed_scale', '64')).toBeNull();
      expect(check('speed_scale', '64.01')?.code).toBe('INVALID_SPEED_SCALE_VALUE');
    });

    it('bounds explosiveness and randomness to 0-1', () => {
      expect(check('explosiveness', '1')).toBeNull();
      expect(check('explosiveness', '1.01')?.code).toBe('INVALID_EXPLOSIVENESS_VALUE');
      expect(check('randomness', '1')).toBeNull();
      expect(check('randomness', '1.01')?.code).toBe('INVALID_RANDOMNESS_VALUE');
    });

    it('accepts a boolean use_fixed_seed', () => {
      expect(check('use_fixed_seed', 'true')).toBeNull();
    });

    it('bounds seed to 0-4294967295 (uint32_t; "0,"+UINT32_MAX+",1", hard both ends)', () => {
      expect(check('seed', '0')).toBeNull();
      expect(check('seed', '4294967295')).toBeNull();
      expect(check('seed', '-1')?.code).toBe('INVALID_SEED_VALUE');
      expect(check('seed', '4294967296')?.code).toBe('INVALID_SEED_VALUE');
    });

    it('bounds lifetime_randomness to 0-1', () => {
      expect(check('lifetime_randomness', '1.5')?.code).toBe('INVALID_LIFETIME_RANDOMNESS_VALUE');
    });

    it('bounds fixed_fps to 0-1000 (no or_greater/or_less)', () => {
      expect(check('fixed_fps', '0')).toBeNull();
      expect(check('fixed_fps', '1000')).toBeNull();
      expect(check('fixed_fps', '1001')?.code).toBe('INVALID_FIXED_FPS_VALUE');
    });

    it('accepts a boolean fract_delta', () => {
      expect(check('fract_delta', 'false')).toBeNull();
    });
  });

  // cpu_particles_3d.cpp:1570-1574 — ADD_GROUP("Drawing", "").
  describe('Drawing group', () => {
    it('accepts an AABB format for visibility_aabb (PROPERTY_HINT_NONE, no range)', () => {
      expect(check('visibility_aabb', 'AABB(0, 0, 0, 1, 1, 1)')).toBeNull();
    });

    it('rejects a malformed visibility_aabb', () => {
      expect(check('visibility_aabb', 'AABB(0, 0, 0)')?.code).toBe('INVALID_VISIBILITY_AABB_FORMAT');
    });

    it('accepts a boolean local_coords', () => {
      expect(check('local_coords', 'true')).toBeNull();
    });

    it('bounds draw_order to 0-2, unlike CPUParticles2D (set_draw_order ERR_FAIL_INDEXes here)', () => {
      expect(check('draw_order', '0')).toBeNull();
      expect(check('draw_order', '2')).toBeNull();
      expect(check('draw_order', '3')?.code).toBe('INVALID_DRAW_ORDER_VALUE');
    });

    it('accepts a resource reference for mesh', () => {
      expect(check('mesh', 'SubResource("1")')).toBeNull();
      expect(check('mesh', 'ExtResource("2")')).toBeNull();
    });

    it('rejects a malformed mesh reference', () => {
      expect(check('mesh', 'not-a-resource')?.code).toBe('INVALID_MESH_REFERENCE');
    });
  });

  // cpu_particles_3d.cpp:1666-1677 — ADD_GROUP("Emission Shape", "emission_").
  describe('Emission Shape group', () => {
    it('accepts every emission_shape enum value 0-6', () => {
      for (const value of ['0', '1', '2', '3', '4', '5', '6']) {
        expect(check('emission_shape', value)).toBeNull();
      }
    });

    it('rejects an emission_shape outside the enum', () => {
      expect(check('emission_shape', '7')?.code).toBe('INVALID_EMISSION_SHAPE_VALUE');
    });

    it('bounds emission_sphere_radius to 0.01-128 (hard both ends)', () => {
      expect(check('emission_sphere_radius', '0.01')).toBeNull();
      expect(check('emission_sphere_radius', '128')).toBeNull();
      expect(check('emission_sphere_radius', '0')?.code).toBe('INVALID_EMISSION_SPHERE_RADIUS_VALUE');
      expect(check('emission_sphere_radius', '128.1')?.code).toBe('INVALID_EMISSION_SPHERE_RADIUS_VALUE');
    });

    it('accepts a Vector3 emission_box_extents', () => {
      expect(check('emission_box_extents', 'Vector3(1, 2, 3)')).toBeNull();
    });

    it('accepts an empty and a populated emission_points/emission_normals (PackedVector3Array)', () => {
      expect(check('emission_points', 'PackedVector3Array()')).toBeNull();
      expect(check('emission_points', 'PackedVector3Array(0, 0, 0, 1, 0, 0)')).toBeNull();
      expect(check('emission_normals', 'PackedVector3Array(0, 1, 0)')).toBeNull();
    });

    it('rejects a malformed emission_points', () => {
      expect(check('emission_points', 'not-an-array')?.code).toBe('INVALID_EMISSION_POINTS_FORMAT');
    });

    // variant_parser.cpp:2519 (points/normals) and :2534 (colors) put every
    // component through `rtos_fix`, which writes `inf` / `inf_neg` / `nan`
    // (:1985-1997). `Number()` reads none of them, so they were format errors on
    // arrays Godot itself wrote.
    it('accepts a non-finite component, which the array writer emits', () => {
      expect(check('emission_points', 'PackedVector3Array(0, inf, 0)')).toBeNull();
      expect(check('emission_normals', 'PackedVector3Array(0, inf_neg, nan)')).toBeNull();
      expect(check('emission_colors', 'PackedColorArray(1, 1, 1, -inf)')).toBeNull();
    });

    it('still rejects an element with trailing garbage', () => {
      // `parseFloat` would read `1abc` as 1; Godot's tokenizer stops the number
      // at `a` and then fails on the unexpected identifier.
      expect(check('emission_points', 'PackedVector3Array(0, 1abc, 0)')?.code).toBe(
        'INVALID_EMISSION_POINTS_FORMAT'
      );
    });

    // variant_parser.cpp:1573 divides the flat float count by 3 with integer
    // division and drops the remainder, so a count that isn't a multiple of 3
    // still loads (as a shorter array) rather than failing to parse.
    it('accepts an emission_points count that is not a multiple of 3', () => {
      expect(check('emission_points', 'PackedVector3Array(0, 0, 1, 0)')).toBeNull();
    });

    it('accepts an empty and a populated emission_colors (PackedColorArray)', () => {
      expect(check('emission_colors', 'PackedColorArray()')).toBeNull();
      expect(check('emission_colors', 'PackedColorArray(1, 1, 1, 1)')).toBeNull();
    });

    // variant_parser.cpp:1609 divides the flat float count by 4 the same way.
    it('accepts an emission_colors count that is not a multiple of 4', () => {
      expect(check('emission_colors', 'PackedColorArray(1, 1, 1)')).toBeNull();
    });

    it('rejects a malformed emission_colors', () => {
      expect(check('emission_colors', 'nope')?.code).toBe('INVALID_EMISSION_COLORS_FORMAT');
    });

    it('accepts a Vector3 emission_ring_axis', () => {
      expect(check('emission_ring_axis', 'Vector3(0, 1, 0)')).toBeNull();
    });

    it('floors emission_ring_height/radius/inner_radius at 0, or_greater lifting the ceiling', () => {
      expect(check('emission_ring_height', '0')).toBeNull();
      expect(check('emission_ring_height', '99999')).toBeNull();
      expect(check('emission_ring_height', '-1')?.code).toBe('INVALID_EMISSION_RING_HEIGHT_VALUE');
      expect(check('emission_ring_radius', '-1')?.code).toBe('INVALID_EMISSION_RING_RADIUS_VALUE');
      expect(check('emission_ring_inner_radius', '-1')?.code).toBe(
        'INVALID_EMISSION_RING_INNER_RADIUS_VALUE'
      );
    });

    it('bounds emission_ring_cone_angle to 0-90 degrees (plain "degrees" hint, not radians_as_degrees)', () => {
      expect(check('emission_ring_cone_angle', '0')).toBeNull();
      expect(check('emission_ring_cone_angle', '90')).toBeNull();
      expect(check('emission_ring_cone_angle', '90.1')?.code).toBe(
        'INVALID_EMISSION_RING_CONE_ANGLE_VALUE'
      );
    });
  });

  // cpu_particles_3d.cpp:1678-1685 — ADD_GROUP("Particle Flags", …) and ADD_GROUP("Direction", "").
  describe('Particle Flags and Direction groups', () => {
    it('accepts boolean particle flags', () => {
      expect(check('particle_flag_align_y', 'true')).toBeNull();
      expect(check('particle_flag_rotate_y', 'false')).toBeNull();
      expect(check('particle_flag_disable_z', 'true')).toBeNull();
    });

    it('accepts a Vector3 direction', () => {
      expect(check('direction', 'Vector3(1, 0, 0)')).toBeNull();
    });

    it('bounds spread to 0-180 (hard both ends)', () => {
      expect(check('spread', '180')).toBeNull();
      expect(check('spread', '180.1')?.code).toBe('INVALID_SPREAD_VALUE');
    });

    it('bounds flatness to 0-1', () => {
      expect(check('flatness', '1.1')?.code).toBe('INVALID_FLATNESS_VALUE');
    });
  });

  // cpu_particles_3d.cpp:1686-1687 — ADD_GROUP("Gravity", "").
  describe('Gravity group', () => {
    it('accepts a Vector3 gravity, including negative components', () => {
      expect(check('gravity', 'Vector3(0, -9.8, 0)')).toBeNull();
    });
  });

  // cpu_particles_3d.cpp:1688-1690 — ADD_GROUP("Initial Velocity", "initial_").
  describe('Initial Velocity group', () => {
    it('floors initial_velocity_min/max at 0, or_greater lifting the ceiling', () => {
      expect(check('initial_velocity_min', '0')).toBeNull();
      expect(check('initial_velocity_max', '99999')).toBeNull();
      expect(check('initial_velocity_min', '-1')?.code).toBe('INVALID_INITIAL_VELOCITY_MIN_VALUE');
    });
  });

  // cpu_particles_3d.cpp:1691-1742 — the min/max/curve triplet groups. `or_less,or_greater`
  // together mean BOTH sides of the stated range are soft, i.e. fully unbounded.
  describe('unbounded min/max families (or_less AND or_greater on both bounds)', () => {
    it('accepts angular_velocity_min/max far outside the stated -720..720 slider range', () => {
      expect(check('angular_velocity_min', '-99999')).toBeNull();
      expect(check('angular_velocity_max', '99999')).toBeNull();
    });

    it('accepts orbit_velocity_min/max far outside the stated -1000..1000 slider range', () => {
      expect(check('orbit_velocity_min', '-99999')).toBeNull();
      expect(check('orbit_velocity_max', '99999')).toBeNull();
    });

    it('accepts linear/radial/tangential accel min/max far outside the stated -100..100 slider range', () => {
      expect(check('linear_accel_min', '-99999')).toBeNull();
      expect(check('linear_accel_max', '99999')).toBeNull();
      expect(check('radial_accel_min', '-99999')).toBeNull();
      expect(check('radial_accel_max', '99999')).toBeNull();
      expect(check('tangential_accel_min', '-99999')).toBeNull();
      expect(check('tangential_accel_max', '99999')).toBeNull();
    });

    it('accepts angle_min/max far outside the stated -720..720 slider range', () => {
      expect(check('angle_min', '-99999')).toBeNull();
      expect(check('angle_max', '99999')).toBeNull();
    });

    it('accepts anim_speed_min/max far outside the stated 0..128 slider range, including negative', () => {
      expect(check('anim_speed_min', '-99999')).toBeNull();
      expect(check('anim_speed_max', '99999')).toBeNull();
    });

    it('rejects a non-numeric value on each unbounded family', () => {
      expect(check('angular_velocity_min', 'fast')?.code).toBe('INVALID_ANGULAR_VELOCITY_MIN_FORMAT');
      expect(check('angle_max', 'fast')?.code).toBe('INVALID_ANGLE_MAX_FORMAT');
    });
  });

  // cpu_particles_3d.cpp:1694, 1698, 1702, 1706, 1710, 1714, 1718 — the *_curve properties.
  describe('*_curve resource references', () => {
    it('accepts a resource reference for every curve property', () => {
      for (const prop of [
        'angular_velocity_curve',
        'orbit_velocity_curve',
        'linear_accel_curve',
        'radial_accel_curve',
        'tangential_accel_curve',
        'damping_curve',
        'angle_curve',
        'scale_amount_curve',
        'scale_curve_x',
        'scale_curve_y',
        'scale_curve_z',
        'hue_variation_curve',
        'anim_speed_curve',
        'anim_offset_curve',
      ]) {
        expect(check(prop, 'SubResource("1")')).toBeNull();
      }
    });

    it('rejects a malformed color_ramp / color_initial_ramp (Gradient references)', () => {
      expect(check('color_ramp', 'not-a-resource')?.code).toBe('INVALID_COLOR_RAMP_REFERENCE');
      expect(check('color_initial_ramp', 'not-a-resource')?.code).toBe(
        'INVALID_COLOR_INITIAL_RAMP_REFERENCE'
      );
    });
  });

  // cpu_particles_3d.cpp:1711-1714 — ADD_GROUP("Damping", "").
  describe('Damping group', () => {
    it('floors damping_min/max at 0, or_greater lifting the ceiling', () => {
      expect(check('damping_min', '0')).toBeNull();
      expect(check('damping_max', '99999')).toBeNull();
      expect(check('damping_min', '-0.001')?.code).toBe('INVALID_DAMPING_MIN_VALUE');
    });
  });

  // cpu_particles_3d.cpp:1719-1726 — ADD_GROUP("Scale", "").
  describe('Scale group', () => {
    it('floors scale_amount_min/max at 0, or_greater lifting the ceiling', () => {
      expect(check('scale_amount_min', '0')).toBeNull();
      expect(check('scale_amount_max', '99999')).toBeNull();
      expect(check('scale_amount_min', '-1')?.code).toBe('INVALID_SCALE_AMOUNT_MIN_VALUE');
    });

    it('accepts a boolean split_scale', () => {
      expect(check('split_scale', 'true')).toBeNull();
    });
  });

  // cpu_particles_3d.cpp:1727-1730 — ADD_GROUP("Color", "").
  describe('Color group', () => {
    it('accepts a Color format', () => {
      expect(check('color', 'Color(1, 1, 1, 1)')).toBeNull();
    });

    it('rejects a malformed color', () => {
      expect(check('color', 'not-a-color')?.code).toBe('INVALID_COLOR_FORMAT');
    });
  });

  // cpu_particles_3d.cpp:1732-1735 — ADD_GROUP("Hue Variation", "hue_").
  describe('Hue Variation group', () => {
    it('bounds hue_variation_min/max to -1..1 (hard both ends)', () => {
      expect(check('hue_variation_min', '-1')).toBeNull();
      expect(check('hue_variation_max', '1')).toBeNull();
      expect(check('hue_variation_min', '-1.01')?.code).toBe('INVALID_HUE_VARIATION_MIN_VALUE');
      expect(check('hue_variation_max', '1.01')?.code).toBe('INVALID_HUE_VARIATION_MAX_VALUE');
    });
  });

  // cpu_particles_3d.cpp:1740-1741 — the one hard-bounded pair in the Animation group.
  describe('Animation group: anim_offset_min/max', () => {
    it('bounds anim_offset_min/max to 0-1 (hard both ends, no or_greater/or_less)', () => {
      expect(check('anim_offset_min', '0')).toBeNull();
      expect(check('anim_offset_max', '1')).toBeNull();
      expect(check('anim_offset_min', '-0.001')?.code).toBe('INVALID_ANIM_OFFSET_MIN_VALUE');
      expect(check('anim_offset_max', '1.001')?.code).toBe('INVALID_ANIM_OFFSET_MAX_VALUE');
    });
  });

  it('resolves an inherited GeometryInstance3D key through the base-walk', () => {
    // Proves the base import is wired: `cast_shadow` is declared on
    // GeometryInstance3D, not on this type, so it must resolve through
    // NODE_BASE_TYPES rather than getOwnKeys.
    const validator = validatorRegistry.findValidator('CPUParticles3D', 'cast_shadow');
    expect(validator).not.toBeNull();
    expect(validatorRegistry.getOwnKeys('CPUParticles3D')).not.toContain('cast_shadow');
  });
});
