/** CPUParticles2D strict validators — property FORMAT checks. */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('CPUParticles2D', {
  emitting: v.boolean('emitting'),
  // cpu_particles_2d.cpp:1492 hints "1,1000000,1,exp" but set_amount
  // (cpu_particles_2d.cpp:67-68) only ERR_FAIL_COND_MSGs below 1; the
  // 1000000 ceiling is never setter-enforced, so — unlike GPUParticles2D's
  // twin — no max is coded here at all.
  amount: v.positiveInt('amount', "Property 'amount' must be greater than 0", {
    enforced: 'cpu_particles_2d.cpp:67',
  }),
  texture: v.resourceReference('texture'),

  // cpu_particles_2d.cpp:1495 hints "0.01,600.0,...,or_greater", but
  // set_lifetime (cpu_particles_2d.cpp:85-87) ERR_FAIL_COND_MSGs at `<= 0`,
  // not at the hint's 0.01 — the setter, not the hint, is what governs.
  lifetime: v.positiveFloat('lifetime', undefined, { enforced: 'cpu_particles_2d.cpp:85' }),
  one_shot: v.boolean('one_shot'),
  // cpu_particles_2d.cpp:1497 hints "0.00,10.0,...,or_greater"; set_pre_process_time
  // (cpu_particles_2d.cpp:94-96) assigns unconditionally.
  preprocess: v.nonNegativeFloat('preprocess', { hinted: 'cpu_particles_2d.cpp:1497' }),
  // cpu_particles_2d.cpp:1498 hints "0,64,0.01" hard both ends; set_speed_scale
  // (cpu_particles_2d.cpp:129-131) assigns unconditionally.
  speed_scale: v.nonNegativeFloat('speed_scale', { hinted: 'cpu_particles_2d.cpp:1498' }),
  // cpu_particles_2d.cpp:1499 hints "0,1,0.01" hard both ends;
  // set_explosiveness_ratio (cpu_particles_2d.cpp:98-100) assigns unconditionally.
  explosiveness: v.float('explosiveness', { min: 0, max: 1, hinted: 'cpu_particles_2d.cpp:1499' }),
  // cpu_particles_2d.cpp:1500 hints "0,1,0.01" hard both ends;
  // set_randomness_ratio (cpu_particles_2d.cpp:102-104) assigns unconditionally.
  randomness: v.float('randomness', { min: 0, max: 1, hinted: 'cpu_particles_2d.cpp:1500' }),
  use_fixed_seed: v.boolean('use_fixed_seed'),
  // cpu_particles_2d.cpp:1502 hints "0,4294967295,1" hard both ends;
  // set_seed (cpu_particles_2d.cpp:612-614) assigns unconditionally — the
  // uint32_t param coerces an out-of-range value rather than rejecting it.
  seed: v.strictNonNegativeInt('seed', { hinted: 'cpu_particles_2d.cpp:1502' }),
  // cpu_particles_2d.cpp:1503 hints "0,1,0.01" hard both ends;
  // set_lifetime_randomness (cpu_particles_2d.cpp:106-108) assigns unconditionally.
  lifetime_randomness: v.float('lifetime_randomness', { min: 0, max: 1, hinted: 'cpu_particles_2d.cpp:1503' }),
  // cpu_particles_2d.cpp:1504 hints "0,1000,1,suffix:FPS"; set_fixed_fps
  // (cpu_particles_2d.cpp:283-285) assigns unconditionally.
  fixed_fps: v.int('fixed_fps', { min: 0, hinted: 'cpu_particles_2d.cpp:1504' }),
  fract_delta: v.boolean('fract_delta'),
  local_coords: v.boolean('local_coords'),
  // Godot's own setter takes any int and its 2D platformer demo ships
  // `draw_order = 215832976`, which the engine reads as Index. Reporting an
  // error would fail a scene Godot opens without complaint, so the range check
  // is deliberately absent here; the lenient parser falls back to Index.

  // cpu_particles_2d.cpp:1586, ENUM 7 labels (matches BIND_ENUM_CONSTANT x7 +
  // EMISSION_SHAPE_MAX=7). set_emission_shape (cpu_particles_2d.cpp:480-481)
  // ERR_FAIL_INDEXes against EMISSION_SHAPE_MAX.
  emission_shape: v.enumInt(
    'emission_shape',
    0,
    6,
    {
      0: 'POINT',
      1: 'SPHERE',
      2: 'SPHERE_SURFACE',
      3: 'RECTANGLE',
      4: 'POINTS',
      5: 'DIRECTED_POINTS',
      6: 'RING',
    },
    { enforced: 'cpu_particles_2d.cpp:480' }
  ),
  // cpu_particles_2d.cpp:1587 hints "0.01,128,0.01,suffix:px" hard both ends;
  // set_emission_sphere_radius (cpu_particles_2d.cpp:491-499) assigns
  // unconditionally (only short-circuits if the value is unchanged).
  emission_sphere_radius: v.nonNegativeFloat('emission_sphere_radius', {
    hinted: 'cpu_particles_2d.cpp:1587',
  }),
  emission_rect_extents: v.vector2('emission_rect_extents'),
  // cpu_particles_2d.cpp:1593 carries NO hint at all, and set_emission_ring_radius
  // (cpu_particles_2d.cpp:531-533) assigns unconditionally — Godot places no
  // bound on this property whatsoever, so none is enforced here either.
  emission_ring_radius: v.float('emission_ring_radius'),
  // cpu_particles_2d.cpp:1592, same shape: no hint, set_emission_ring_inner_radius
  // (cpu_particles_2d.cpp:527-529) assigns unconditionally.
  emission_ring_inner_radius: v.float('emission_ring_inner_radius'),
  emission_points: v.packedVector2Array('emission_points'),
  emission_normals: v.packedVector2Array('emission_normals'),

  particle_flag_align_y: v.boolean('particle_flag_align_y'),
  direction: v.vector2('direction'),
  // cpu_particles_2d.cpp:1598 hints "0,180,0.01" hard both ends; set_spread
  // (cpu_particles_2d.cpp:344-348) assigns unconditionally.
  spread: v.float('spread', { min: 0, max: 180, hinted: 'cpu_particles_2d.cpp:1598' }),
  gravity: v.vector2('gravity'),

  initial_velocity_min: v.float('initial_velocity_min'),
  initial_velocity_max: v.float('initial_velocity_max'),
  angular_velocity_min: v.float('angular_velocity_min'),
  angular_velocity_max: v.float('angular_velocity_max'),
  angular_velocity_curve: v.resourceReference('angular_velocity_curve'),
  orbit_velocity_min: v.float('orbit_velocity_min'),
  orbit_velocity_max: v.float('orbit_velocity_max'),
  orbit_velocity_curve: v.resourceReference('orbit_velocity_curve'),
  linear_accel_min: v.float('linear_accel_min'),
  linear_accel_max: v.float('linear_accel_max'),
  linear_accel_curve: v.resourceReference('linear_accel_curve'),
  radial_accel_min: v.float('radial_accel_min'),
  radial_accel_max: v.float('radial_accel_max'),
  radial_accel_curve: v.resourceReference('radial_accel_curve'),
  tangential_accel_min: v.float('tangential_accel_min'),
  tangential_accel_max: v.float('tangential_accel_max'),
  tangential_accel_curve: v.resourceReference('tangential_accel_curve'),
  // cpu_particles_2d.cpp:1625-1626 hint "0,100,0.001,or_greater" (or_greater
  // opens the ceiling); set_param_min/set_param_max (cpu_particles_2d.cpp:352,
  // 367) only ERR_FAIL_INDEX the Parameter enum, the value itself is
  // unconditional.
  damping_min: v.nonNegativeFloat('damping_min', { hinted: 'cpu_particles_2d.cpp:1625' }),
  damping_max: v.nonNegativeFloat('damping_max', { hinted: 'cpu_particles_2d.cpp:1626' }),
  damping_curve: v.resourceReference('damping_curve'),
  angle_min: v.float('angle_min'),
  angle_max: v.float('angle_max'),
  angle_curve: v.resourceReference('angle_curve'),
  // cpu_particles_2d.cpp:1633-1634 hint "0,1000,0.01,or_greater"; same generic
  // set_param_min/max, value unconditional.
  scale_amount_min: v.nonNegativeFloat('scale_amount_min', { hinted: 'cpu_particles_2d.cpp:1633' }),
  scale_amount_max: v.nonNegativeFloat('scale_amount_max', { hinted: 'cpu_particles_2d.cpp:1634' }),
  scale_amount_curve: v.resourceReference('scale_amount_curve'),
  // cpu_particles_2d.cpp:1646-1647 hint "-1,1,0.01" hard both ends; same
  // generic set_param_min/max, value unconditional.
  hue_variation_min: v.float('hue_variation_min', { min: -1, max: 1, hinted: 'cpu_particles_2d.cpp:1646' }),
  hue_variation_max: v.float('hue_variation_max', { min: -1, max: 1, hinted: 'cpu_particles_2d.cpp:1647' }),
  hue_variation_curve: v.resourceReference('hue_variation_curve'),
  anim_speed_min: v.float('anim_speed_min'),
  anim_speed_max: v.float('anim_speed_max'),
  anim_speed_curve: v.resourceReference('anim_speed_curve'),
  anim_offset_min: v.float('anim_offset_min'),
  anim_offset_max: v.float('anim_offset_max'),
  anim_offset_curve: v.resourceReference('anim_offset_curve'),

  color: v.color('color'),
  color_ramp: v.resourceReference('color_ramp'),
  color_initial_ramp: v.resourceReference('color_initial_ramp'),

  split_scale: v.boolean('split_scale'),
  scale_curve_x: v.resourceReference('scale_curve_x'),
  scale_curve_y: v.resourceReference('scale_curve_y'),
});
