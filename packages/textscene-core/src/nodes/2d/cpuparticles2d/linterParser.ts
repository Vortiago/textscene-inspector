/** CPUParticles2D strict validators — property FORMAT checks. */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('CPUParticles2D', {
  emitting: v.boolean('emitting'),
  amount: v.positiveInt('amount', "Property 'amount' must be greater than 0"),
  texture: v.resourceReference('texture'),

  lifetime: v.positiveFloat('lifetime'),
  one_shot: v.boolean('one_shot'),
  preprocess: v.nonNegativeFloat('preprocess'),
  speed_scale: v.nonNegativeFloat('speed_scale'),
  explosiveness: v.float('explosiveness', { min: 0, max: 1 }),
  randomness: v.float('randomness', { min: 0, max: 1 }),
  use_fixed_seed: v.boolean('use_fixed_seed'),
  seed: v.strictNonNegativeInt('seed'),
  lifetime_randomness: v.float('lifetime_randomness', { min: 0, max: 1 }),
  fixed_fps: v.int('fixed_fps', { min: 0 }),
  fract_delta: v.boolean('fract_delta'),
  local_coords: v.boolean('local_coords'),
  // Godot's own setter takes any int and its 2D platformer demo ships
  // `draw_order = 215832976`, which the engine reads as Index. Reporting an
  // error would fail a scene Godot opens without complaint, so the range check
  // is deliberately absent here; the lenient parser falls back to Index.

  emission_shape: v.enumInt('emission_shape', 0, 6, {
    0: 'POINT',
    1: 'SPHERE',
    2: 'SPHERE_SURFACE',
    3: 'RECTANGLE',
    4: 'POINTS',
    5: 'DIRECTED_POINTS',
    6: 'RING',
  }),
  emission_sphere_radius: v.nonNegativeFloat('emission_sphere_radius'),
  emission_rect_extents: v.vector2('emission_rect_extents'),
  emission_ring_radius: v.nonNegativeFloat('emission_ring_radius'),
  emission_ring_inner_radius: v.nonNegativeFloat('emission_ring_inner_radius'),
  emission_points: v.packedVector2Array('emission_points'),
  emission_normals: v.packedVector2Array('emission_normals'),

  particle_flag_align_y: v.boolean('particle_flag_align_y'),
  direction: v.vector2('direction'),
  spread: v.float('spread', { min: 0, max: 180 }),
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
  damping_min: v.nonNegativeFloat('damping_min'),
  damping_max: v.nonNegativeFloat('damping_max'),
  damping_curve: v.resourceReference('damping_curve'),
  angle_min: v.float('angle_min'),
  angle_max: v.float('angle_max'),
  angle_curve: v.resourceReference('angle_curve'),
  scale_amount_min: v.nonNegativeFloat('scale_amount_min'),
  scale_amount_max: v.nonNegativeFloat('scale_amount_max'),
  scale_amount_curve: v.resourceReference('scale_amount_curve'),
  hue_variation_min: v.float('hue_variation_min', { min: -1, max: 1 }),
  hue_variation_max: v.float('hue_variation_max', { min: -1, max: 1 }),
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
