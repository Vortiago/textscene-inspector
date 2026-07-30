/**
 * CPUParticles2D — Godot's CPU-simulated 2D particle emitter.
 *
 * Every default here is the one Godot's own constructor installs
 * (`scene/2d/cpu_particles_2d.h`), because a particle node in a real scene
 * writes only the handful of properties it changed: the candle's Fire emitter
 * sets only a handful, and the rest ARE the look.
 */

import type { Node2DProperties, Color, Vector2 } from '../../base/node2d/types';

/** Godot `CPUParticles2D.EmissionShape`. */
export enum CPUParticles2DEmissionShape {
  Point = 0,
  Sphere = 1,
  SphereSurface = 2,
  Rectangle = 3,
  /** Positions sampled from `emission_points` — not previewed (see linter.ts). */
  Points = 4,
  /** As Points, but the normal also steers the initial velocity — not previewed. */
  DirectedPoints = 5,
  /** An annulus between the inner and outer radius — not previewed. */
  Ring = 6,
}

/** Godot `CPUParticles2D.DrawOrder`. */
export enum CPUParticles2DDrawOrder {
  /** Draw in particle-index order. */
  Index = 0,
  /** Draw oldest first, so younger particles land on top. */
  Lifetime = 1,
}

/**
 * Godot `CPUParticles2D.Parameter`. Every one is `lerp(min, max, random) *
 * curve.sample(t)` — one mechanism, twelve slots.
 */
export enum CPUParticles2DParam {
  InitialLinearVelocity = 0,
  AngularVelocity = 1,
  OrbitVelocity = 2,
  LinearAccel = 3,
  RadialAccel = 4,
  TangentialAccel = 5,
  Damping = 6,
  Angle = 7,
  Scale = 8,
  HueVariation = 9,
  AnimSpeed = 10,
  AnimOffset = 11,
}

/** `PARAM_MAX` — the length of every parameter array. */
export const CPU_PARTICLES_2D_PARAM_COUNT = 12;

/**
 * The twelve parameter slots, in `CPUParticles2DParam` order: the serialised
 * property prefix (`<prefix>_min` / `_max` / `_curve`), the Inspector label, the
 * Godot default both `_min` and `_max` take, and whether Godot exposes a curve.
 *
 * ONE table because `def` is read from two directions: the parser applies it,
 * and the formatter hides a slot that still holds it. Two copies drift into the
 * Inspector silently hiding an authored value, or showing an untouched one, and
 * no test would catch the disagreement.
 */
export const PARAM_SLOTS: ReadonlyArray<{
  prefix: string;
  label: string;
  def: number;
  curve: boolean;
}> = [
  { prefix: 'initial_velocity', label: 'Initial Velocity', def: 0, curve: false },
  { prefix: 'angular_velocity', label: 'Angular Velocity', def: 0, curve: true },
  { prefix: 'orbit_velocity', label: 'Orbit Velocity', def: 0, curve: true },
  { prefix: 'linear_accel', label: 'Linear Accel', def: 0, curve: true },
  { prefix: 'radial_accel', label: 'Radial Accel', def: 0, curve: true },
  { prefix: 'tangential_accel', label: 'Tangential Accel', def: 0, curve: true },
  { prefix: 'damping', label: 'Damping', def: 0, curve: true },
  { prefix: 'angle', label: 'Angle', def: 0, curve: true },
  { prefix: 'scale_amount', label: 'Scale Amount', def: 1, curve: true },
  { prefix: 'hue_variation', label: 'Hue Variation', def: 0, curve: true },
  { prefix: 'anim_speed', label: 'Anim Speed', def: 0, curve: true },
  { prefix: 'anim_offset', label: 'Anim Offset', def: 0, curve: true },
];

/** One parameter slot: the random range plus the optional shaping curve. */
export interface ParticleParam {
  min: number;
  max: number;
  /**
   * Raw `SubResource("id")` reference to a `Curve`, resolved at render time
   * (the parser sees property strings, not the scene's resource table).
   * `InitialLinearVelocity` has no serialised curve property in Godot, so its
   * slot is always absent.
   */
  curve?: string;
}

export interface CPUParticles2DProperties extends Node2DProperties {
  /** When false the emitter draws nothing at all (`cpu_particles_2d.cpp:717-728`). */
  emitting: boolean;
  /** Particle count. Godot's inspector caps this at 1,000,000. */
  amount: number;
  /** Raw texture reference (`ExtResource`/`SubResource`); absent means a 1×1 quad. */
  texture?: string;

  lifetime: number;
  one_shot: boolean;
  /** Seconds of simulation Godot runs before the first frame is shown. */
  preprocess: number;
  speed_scale: number;
  explosiveness: number;
  randomness: number;
  use_fixed_seed: boolean;
  seed: number;
  lifetime_randomness: number;
  /** Simulation rate; 0 means Godot's 30 Hz fallback. */
  fixed_fps: number;
  /** Godot default TRUE — a restarting particle gets a partial first step. */
  fract_delta: boolean;
  /** When false (Godot's default) particles live in canvas space, not node space. */
  local_coords: boolean;
  draw_order: CPUParticles2DDrawOrder;

  emission_shape: CPUParticles2DEmissionShape;
  emission_sphere_radius: number;
  emission_rect_extents: Vector2;
  emission_ring_radius: number;
  emission_ring_inner_radius: number;

  /** `particle_flag_align_y` — orient each quad along its velocity. */
  particle_flag_align_y: boolean;
  direction: Vector2;
  /** Degrees of half-cone either side of `direction`. */
  spread: number;
  gravity: Vector2;

  /** Indexed by `CPUParticles2DParam`; always `CPU_PARTICLES_2D_PARAM_COUNT` long. */
  params: ParticleParam[];

  color: Color;
  /** Raw `SubResource("id")` reference to a `Gradient` sampled over particle age. */
  color_ramp?: string;
  /** Raw `SubResource("id")` reference to a `Gradient` sampled once at birth. */
  color_initial_ramp?: string;
}
