/**
 * CPUParticles2D: Godot's CPU-simulated 2D particle emitter. Every default is the
 * one Godot's constructor installs (`scene/2d/cpu_particles_2d.h`), since a scene
 * writes only the few properties it changed.
 */

import type { Node2DProperties } from '../../base/node2d/types';
import type { ParticleParam } from '../../shared/cpuparticles/params';
import type { Rgba } from '../../../godot/math/math';
import type { Vector2 } from '../../../godot/math/vector';
import { CPUParticles2DEmissionShape, CPUParticles2DDrawOrder } from '../../../godot/scene/particles2d';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

export interface CPUParticles2DProperties extends Node2DProperties {
  /** When false the emitter draws nothing at all (`cpu_particles_2d.cpp:717-728`). */
  emitting: boolean;
  /** Particle count. Godot's inspector caps this at 1,000,000. */
  amount: number;
  /** Raw texture reference (`ExtResource`/`SubResource`). Absent means a 1×1 quad. */
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
  /** Simulation rate. 0 means Godot's 30 Hz fallback. */
  fixed_fps: number;
  /** Godot default true: a restarting particle gets a partial first step. */
  fract_delta: boolean;
  /** When false (Godot's default) particles live in canvas space, not node space. */
  local_coords: boolean;
  draw_order: EnumValue<typeof CPUParticles2DDrawOrder>;

  emission_shape: EnumValue<typeof CPUParticles2DEmissionShape>;
  emission_sphere_radius: number;
  emission_rect_extents: Vector2;
  emission_ring_radius: number;
  emission_ring_inner_radius: number;

  /** `particle_flag_align_y`: orient each quad along its velocity. */
  particle_flag_align_y: boolean;
  direction: Vector2;
  /** Degrees of half-cone either side of `direction`. */
  spread: number;
  gravity: Vector2;

  /** Indexed by `CPUParticlesParameter`. Always `CPU_PARTICLES_PARAM_COUNT` long. */
  params: ParticleParam[];

  color: Rgba;
  /** Raw `SubResource("id")` reference to a `Gradient` sampled over particle age. */
  color_ramp?: string;
  /** Raw `SubResource("id")` reference to a `Gradient` sampled once at birth. */
  color_initial_ramp?: string;
}
