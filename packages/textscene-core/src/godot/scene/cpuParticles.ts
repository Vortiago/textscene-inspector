/** The random-range parameters CPUParticles2D and CPUParticles3D share, and their serialised prefixes. */

/**
 * The `Parameter` enum both classes declare alike (`cpu_particles_2d.h:48-62`,
 * `cpu_particles_3d.h:50-64`), `PARAM_MAX` left out and each member without `PARAM_`. It indexes
 * {@link CPU_PARTICLES_PARAMS}.
 */
export const CPUParticlesParameter = {
  INITIAL_LINEAR_VELOCITY: 0,
  ANGULAR_VELOCITY: 1,
  ORBIT_VELOCITY: 2,
  LINEAR_ACCEL: 3,
  RADIAL_ACCEL: 4,
  TANGENTIAL_ACCEL: 5,
  DAMPING: 6,
  ANGLE: 7,
  SCALE: 8,
  HUE_VARIATION: 9,
  ANIM_SPEED: 10,
  ANIM_OFFSET: 11,
} as const;

/**
 * The prefix each {@link CPUParticlesParameter} serialises its `_min`, `_max` and `_curve` keys
 * under, in enum order. `PARAM_SCALE` serialises as `scale_amount`.
 */
export const CPU_PARTICLES_PARAMS = [
  'initial_velocity',
  'angular_velocity',
  'orbit_velocity',
  'linear_accel',
  'radial_accel',
  'tangential_accel',
  'damping',
  'angle',
  'scale_amount',
  'hue_variation',
  'anim_speed',
  'anim_offset',
] as const;

export type CpuParticlesParam = (typeof CPU_PARTICLES_PARAMS)[number];
