/**
 * The values a particle draws from its seed, in the order the shader draws them
 * (`particle_process_material.cpp:571-608`: "DO NOT REORDER OPERATIONS"). A parameter this port
 * does not read still takes its draw, so that every later draw lands on the stream Godot reads.
 *
 * Derived from Godot Engine (`scene/resources/particle_process_material.cpp`), used
 * under the MIT licence:
 *
 *   Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md).
 *   Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 *
 *   Permission is hereby granted, free of charge, to any person obtaining
 *   a copy of this software and associated documentation files (the
 *   "Software"), to deal in the Software without restriction, including
 *   without limitation the rights to use, copy, modify, merge, publish,
 *   distribute, sublicense, and/or sell copies of the Software, and to
 *   permit persons to whom the Software is furnished to do so, subject to
 *   the following conditions:
 *
 *   The above copyright notice and this permission notice shall be
 *   included in all copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 *   EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 *   MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 *   IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 *   CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 *   TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 *   SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * See THIRD-PARTY-NOTICES.md.
 */

import { storedReal as f } from '../../../godot/math/real.js';
import type { ParamRange, ProcessSimulation } from '../../../resources/materials/particleprocessmaterial';
import { rotateHueInto } from '../cpuparticles/process';
import { idhash, randFromSeed, type SeedRef } from '../cpuparticles/godotRng';
import { mix } from './float3';

/** `float pi = 3.14159;` of the generated shader, which is not `Math.PI`. */
export const SHADER_PI = f(3.14159);

/** `degree_to_rad = pi / 180.0`. */
export const DEGREE_TO_RAD = f(SHADER_PI / 180);

/** `rotate_hue(color_value, 0.0)`, which tints even at an angle of 0. */
export function tintedColour({ color }: ProcessSimulation): [number, number, number, number] {
  const rotated = rotateHueInto({ r: 0, g: 0, b: 0, a: 0 }, color, 0);
  return [rotated.r, rotated.g, rotated.b, rotated.a];
}

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
