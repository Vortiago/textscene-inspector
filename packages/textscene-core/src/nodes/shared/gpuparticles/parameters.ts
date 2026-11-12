/**
 * The values a particle draws from its seed, in the order the shader draws them
 * (`particle_process_material.cpp:571-608`: "DO NOT REORDER OPERATIONS"). A parameter this port
 * does not read still takes its draw, so that every later draw lands on the stream Godot reads.
 */

import { storedReal as f } from '../../../godot/math/real.js';
import type { ParamRange, ProcessSimulation } from '../../../resources/materials/particleprocessmaterial';
import { idhash, randFromSeed, type SeedRef } from '../cpuparticles/godotRng';
import { mix } from './float3';

/** `float pi = 3.14159;` of the generated shader, which is not `Math.PI`. */
export const SHADER_PI = f(3.14159);

/** `degree_to_rad = pi / 180.0`. */
export const DEGREE_TO_RAD = f(SHADER_PI / 180);

export interface DrawnParameters {
  /** The scale factor of every axis before the shader's sign and floor. */
  scale: number;
  /** The share of the lifetime the particle lives: `1 - lifetime_randomness * draw`. */
  lifetimeShare: number;
  linearAccel: number;
  radialAccel: number;
  tangentialAccel: number;
  initialVelocity: number;
}

function drawIn(range: ParamRange, seed: SeedRef): number {
  return mix(range.min, range.max, randFromSeed(seed));
}

/** The seed of particle number `number`: `hash(number + 1 + RANDOM_SEED)` (`:861-863`). */
export function seedOf(number: number, randomSeed: number): SeedRef {
  return { value: idhash((number + 1 + randomSeed) >>> 0) };
}

/** The display, dynamics and physical draws of `calculate_initial_*_params`, in order, off `seed`. */
export function drawParameters(seed: SeedRef, simulation: ProcessSimulation): DrawnParameters {
  const scale = drawIn(simulation.scale, seed);
  randFromSeed(seed); // hue_rotation
  randFromSeed(seed); // animation_speed
  randFromSeed(seed); // animation_offset
  const lifetimeShare = f(1 - f(simulation.lifetimeRandomness * randFromSeed(seed)));
  randFromSeed(seed); // angle
  randFromSeed(seed); // angular_velocity
  const initialVelocity = drawIn(simulation.initialVelocity, seed);
  randFromSeed(seed); // directional_velocity
  randFromSeed(seed); // radial_velocity
  randFromSeed(seed); // orbit_velocity
  const linearAccel = drawIn(simulation.linearAccel, seed);
  const radialAccel = drawIn(simulation.radialAccel, seed);
  const tangentialAccel = drawIn(simulation.tangentialAccel, seed);
  randFromSeed(seed); // damping
  return { scale, lifetimeShare, linearAccel, radialAccel, tangentialAccel, initialVelocity };
}
