/**
 * The `Parameter` enum CPUParticles2D and CPUParticles3D declare alike (`cpu_particles_2d.h:48-62`,
 * `cpu_particles_3d.h:50-64`), in enum order, as the prefix each slot serialises its `_min`,
 * `_max` and `_curve` keys under. `PARAM_SCALE` serialises as `scale_amount`.
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
