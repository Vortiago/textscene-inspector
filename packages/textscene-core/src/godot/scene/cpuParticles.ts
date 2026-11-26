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

/** The Inspector label, the Godot default of `_min` and `_max`, and whether Godot exposes a curve. */
interface SlotDetails {
  label: string;
  def: number;
  curve: boolean;
}

// Both constructors set these defaults (cpu_particles_2d.cpp:1698-1722, cpu_particles_3d.cpp:1786-1809).
const SLOT_DETAILS: Readonly<Record<CpuParticlesParam, SlotDetails>> = {
  initial_velocity: { label: 'Initial Velocity', def: 0, curve: false },
  angular_velocity: { label: 'Angular Velocity', def: 0, curve: true },
  orbit_velocity: { label: 'Orbit Velocity', def: 0, curve: true },
  linear_accel: { label: 'Linear Accel', def: 0, curve: true },
  radial_accel: { label: 'Radial Accel', def: 0, curve: true },
  tangential_accel: { label: 'Tangential Accel', def: 0, curve: true },
  damping: { label: 'Damping', def: 0, curve: true },
  angle: { label: 'Angle', def: 0, curve: true },
  scale_amount: { label: 'Scale Amount', def: 1, curve: true },
  hue_variation: { label: 'Hue Variation', def: 0, curve: true },
  anim_speed: { label: 'Anim Speed', def: 0, curve: true },
  anim_offset: { label: 'Anim Offset', def: 0, curve: true },
};

/** One table, so the parser applies the `def` the formatter hides a slot at. */
export const PARAM_SLOTS: ReadonlyArray<{ prefix: CpuParticlesParam } & SlotDetails> =
  CPU_PARTICLES_PARAMS.map((prefix) => ({ prefix, ...SLOT_DETAILS[prefix] }));
