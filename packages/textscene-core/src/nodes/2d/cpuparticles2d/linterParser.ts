/** CPUParticles2D strict validators — property FORMAT checks. */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

// cpu_particles_2d.cpp:1509 hints 2 labels ("Index,Lifetime");
// BIND_ENUM_CONSTANT binds both (:1511-1512). NOT the same enum as
// GPUParticles2D's DrawOrder (gpu_particles_2d.h:40-43 has a third,
// REVERSE_LIFETIME) despite the identical property name.
const DRAW_ORDER = { 0: 'INDEX', 1: 'LIFETIME' };

validatorRegistry.registerAll('CPUParticles2D', {
  emitting: v.boolean('emitting'),
  // cpu_particles_2d.cpp:1492 hints "1,1000000,1,exp", closed at both ends.
  // set_amount ERR_FAIL_COND_MSGs below 1 (cpu_particles_2d.cpp:68), so the
  // floor is enforced; the ceiling is never checked, which makes it a warning
  // rather than nothing at all. The CPUParticles3D twin reads the same hint the
  // same way.
  amount: v.int('amount', {
    min: 1,
    max: 1000000,
    enforced: { min: 'cpu_particles_2d.cpp:68' },
    hinted: { max: 'cpu_particles_2d.cpp:1492' },
  }),
  texture: v.resourceReference('texture'),

  // cpu_particles_2d.cpp:1495 hints "0.01,600.0,0.01,or_greater,exp,suffix:s",
  // whose ceiling `or_greater` opens. set_lifetime (cpu_particles_2d.cpp:86)
  // ERR_FAIL_COND_MSGs at `<= 0`, below the hint's floor, so (0, 0.01) loads
  // into Godot and only warns.
  lifetime: v.positiveFloat('lifetime', undefined, {
    min: 0.01,
    enforced: 'cpu_particles_2d.cpp:86',
    hinted: 'cpu_particles_2d.cpp:1495',
  }),
  one_shot: v.boolean('one_shot'),
  // cpu_particles_2d.cpp:1497 hints "0.00,10.0,...,or_greater"; set_pre_process_time
  // (cpu_particles_2d.cpp:94-96) assigns unconditionally.
  preprocess: v.nonNegativeFloat('preprocess', { hinted: 'cpu_particles_2d.cpp:1497' }),
  // cpu_particles_2d.cpp:1498 hints "0,64,0.01", closed at both ends;
  // set_speed_scale (cpu_particles_2d.cpp:129-131) assigns unconditionally, so
  // both ends warn. A closed end that the setter ignores is the definition of
  // the hinted tier, not a reason to leave it uncoded.
  speed_scale: v.float('speed_scale', { min: 0, max: 64, hinted: 'cpu_particles_2d.cpp:1498' }),
  // cpu_particles_2d.cpp:1499 hints "0,1,0.01" hard both ends;
  // set_explosiveness_ratio (cpu_particles_2d.cpp:98-100) assigns unconditionally.
  explosiveness: v.float('explosiveness', { min: 0, max: 1, hinted: 'cpu_particles_2d.cpp:1499' }),
  // cpu_particles_2d.cpp:1500 hints "0,1,0.01" hard both ends;
  // set_randomness_ratio (cpu_particles_2d.cpp:102-104) assigns unconditionally.
  randomness: v.float('randomness', { min: 0, max: 1, hinted: 'cpu_particles_2d.cpp:1500' }),
  use_fixed_seed: v.boolean('use_fixed_seed'),
  // cpu_particles_2d.cpp:1502 hints "0," + itos(UINT32_MAX) + ",1" hard both
  // ends; set_seed (cpu_particles_2d.cpp:613) is `seed = p_seed;` — the
  // uint32_t param coerces an out-of-range value rather than rejecting it.
  // UINT32_MAX as a literal, and the same combinator, as in the three sibling
  // particle slices.
  seed: v.int('seed', { min: 0, max: 4294967295, hinted: 'cpu_particles_2d.cpp:1502' }),
  // cpu_particles_2d.cpp:1503 hints "0,1,0.01" hard both ends;
  // set_lifetime_randomness (cpu_particles_2d.cpp:106-108) assigns unconditionally.
  lifetime_randomness: v.float('lifetime_randomness', { min: 0, max: 1, hinted: 'cpu_particles_2d.cpp:1503' }),
  // cpu_particles_2d.cpp:1504 hints "0,1000,1,suffix:FPS" — hard both ends, the
  // `suffix:` is a unit. set_fixed_fps (cpu_particles_2d.cpp:283-285) assigns
  // unconditionally, so both ends warn; same bound as the CPUParticles3D twin.
  fixed_fps: v.int('fixed_fps', { min: 0, max: 1000, hinted: 'cpu_particles_2d.cpp:1504' }),
  fract_delta: v.boolean('fract_delta'),
  local_coords: v.boolean('local_coords'),
  // cpu_particles_2d.cpp:1509 hints "Index,Lifetime" (enum 0-1);
  // set_draw_order (cpu_particles_2d.cpp:173-175) is `draw_order = p_order;`
  // with no ERR_FAIL_INDEX and no CLAMP, so out of range is a warning, not an
  // error — Godot's own 2D platformer demo ships `draw_order = 215832976`,
  // which the engine reads as Index, and a warning does not fail that scene.
  draw_order: v.enumInt('draw_order', 0, 1, DRAW_ORDER, { hinted: 'cpu_particles_2d.cpp:1509' }),

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
    { enforced: 'cpu_particles_2d.cpp:481' }
  ),
  // cpu_particles_2d.cpp:1587 hints "0.01,128,0.01,suffix:px" hard both ends;
  // set_emission_sphere_radius (cpu_particles_2d.cpp:491-499) assigns
  // unconditionally (only short-circuits if the value is unchanged), so both
  // ends are warnings. Same bound as the CPUParticles3D twin.
  emission_sphere_radius: v.float('emission_sphere_radius', {
    min: 0.01,
    max: 128,
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
  // cpu_particles_2d.cpp:1591, PropertyInfo(Variant::PACKED_COLOR_ARRAY, …).
  // get_emission_colors (cpu_particles_2d.cpp:551-553) returns `Vector<Color>`,
  // not a `TypedArray<Color>`, so this is a genuine PackedColorArray, not the
  // `Array[Color]([…])` spelling a TypedArray getter behind the same
  // PropertyInfo type would write.
  emission_colors: v.packedColorArray('emission_colors'),

  particle_flag_align_y: v.boolean('particle_flag_align_y'),
  direction: v.vector2('direction'),
  // cpu_particles_2d.cpp:1598 hints "0,180,0.01" hard both ends; set_spread
  // (cpu_particles_2d.cpp:344-348) assigns unconditionally.
  spread: v.float('spread', { min: 0, max: 180, hinted: 'cpu_particles_2d.cpp:1598' }),
  gravity: v.vector2('gravity'),

  // cpu_particles_2d.cpp:1602-1603 hint "0,1000,0.01,or_greater,suffix:px/s":
  // or_greater opens the ceiling and `suffix:` is a unit, so only the floor
  // binds. set_param_min/set_param_max (cpu_particles_2d.cpp:353, 368)
  // ERR_FAIL_INDEX the Parameter enum, never the value.
  initial_velocity_min: v.nonNegativeFloat('initial_velocity_min', {
    hinted: 'cpu_particles_2d.cpp:1602',
  }),
  initial_velocity_max: v.nonNegativeFloat('initial_velocity_max', {
    hinted: 'cpu_particles_2d.cpp:1603',
  }),
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
  // cpu_particles_2d.cpp:1653-1654 hint "0,1,0.0001" hard both ends; the same
  // generic set_param_min/max (:353, :368) guards only the Parameter index.
  anim_offset_min: v.float('anim_offset_min', { min: 0, max: 1, hinted: 'cpu_particles_2d.cpp:1653' }),
  anim_offset_max: v.float('anim_offset_max', { min: 0, max: 1, hinted: 'cpu_particles_2d.cpp:1654' }),
  anim_offset_curve: v.resourceReference('anim_offset_curve'),

  color: v.color('color'),
  color_ramp: v.resourceReference('color_ramp'),
  color_initial_ramp: v.resourceReference('color_initial_ramp'),

  split_scale: v.boolean('split_scale'),
  scale_curve_x: v.resourceReference('scale_curve_x'),
  scale_curve_y: v.resourceReference('scale_curve_y'),
});
