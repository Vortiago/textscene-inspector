/**
 * `process()` of the generated particle shader (`particle_process_material.cpp:925-1160`): one
 * step of a live particle. The main velocity step of `particles.glsl` is off (`disable_velocity`),
 * so the position moves once, here.
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
import type { ProcessSimulation } from '../../../resources/materials/particleprocessmaterial';
import { normalize, type Float3 } from './float3';
import { tintedColour } from './parameters';
import type { EmissionFrame, GpuParticle } from './particle';

/** What a step reads of the frame and of the emitter. */
export interface StepContext {
  simulation: ProcessSimulation;
  frame: EmissionFrame;
  /** `params.lifetime`, a float. */
  lifetime: number;
  /** `GRAVITY`, a float vector. */
  gravity: Float3;
  /** `normalize(GRAVITY)`: NaN components for a zero gravity, so no tangential force follows. */
  gravityDirection: Float3;
  /** `rotate_hue(color_value, 0.0)`: one tuple, shared by every live particle and never written. */
  colour: [number, number, number, number];
}

/** The step context of an emitter: the terms that do not change from particle to particle. */
export function stepContextOf(
  simulation: ProcessSimulation,
  frame: EmissionFrame,
  lifetime: number
): StepContext {
  const gravity: Float3 = [simulation.gravity.x, simulation.gravity.y, simulation.gravity.z];
  return {
    simulation,
    frame,
    lifetime,
    gravity,
    gravityDirection: normalize(gravity),
    colour: tintedColour(simulation),
  };
}

/** The smallest axis scale, so that a scale of 0 still draws (`:1138-1145`). */
const SCALE_FLOOR = 0.001;

/**
 * Steps `particle` by `delta` seconds, with the draws of its birth. It writes the particle in place
 * and allocates nothing: the settle runs it for every particle on every step, up to a million particles.
 */
export function stepParticle(particle: GpuParticle, delta: number, context: StepContext): void {
  const { frame, gravity, gravityDirection } = context;
  const { drawn, velocity, origin } = particle;
  if (!drawn) return;

  const age = f(particle.custom[1] + f(delta / context.lifetime));
  particle.custom[1] = age;
  if (age > particle.custom[3]) particle.active = false;

  let forceX = gravity[0];
  let forceY = gravity[1];
  let forceZ = gravity[2];
  const speed = lengthOf(velocity[0], velocity[1], velocity[2]);
  if (speed > 0) {
    forceX = f(forceX + f(f(velocity[0] / speed) * drawn.linearAccel));
    forceY = f(forceY + f(f(velocity[1] / speed) * drawn.linearAccel));
    forceZ = f(forceZ + f(f(velocity[2] / speed) * drawn.linearAccel));
  }
  const offsetX = f(origin[0] - frame.origin[0]);
  const offsetY = f(origin[1] - frame.origin[1]);
  const offsetZ = f(origin[2] - frame.origin[2]);
  const distance = lengthOf(offsetX, offsetY, offsetZ);
  // A zero offset divides 0 by 0: the unit offset is NaN, and so is the tangent that follows.
  const unitX = f(offsetX / distance);
  const unitY = f(offsetY / distance);
  const unitZ = f(offsetZ / distance);
  if (distance > 0) {
    forceX = f(forceX + f(unitX * drawn.radialAccel));
    forceY = f(forceY + f(unitY * drawn.radialAccel));
    forceZ = f(forceZ + f(unitZ * drawn.radialAccel));
  }
  // `cross(normalize(diff), normalize(gravity))` is NaN without a diff or a gravity: no force.
  const aroundX = f(f(unitY * gravityDirection[2]) - f(gravityDirection[1] * unitZ));
  const aroundY = f(f(unitZ * gravityDirection[0]) - f(gravityDirection[2] * unitX));
  const aroundZ = f(f(unitX * gravityDirection[1]) - f(gravityDirection[0] * unitY));
  const around = lengthOf(aroundX, aroundY, aroundZ);
  if (around > 0) {
    forceX = f(forceX + f(f(aroundX / around) * drawn.tangentialAccel));
    forceY = f(forceY + f(f(aroundY / around) * drawn.tangentialAccel));
    forceZ = f(forceZ + f(f(aroundZ / around) * drawn.tangentialAccel));
  }

  velocity[0] = f(velocity[0] + f(forceX * delta));
  velocity[1] = f(velocity[1] + f(forceY * delta));
  velocity[2] = f(velocity[2] + f(forceZ * delta));
  origin[0] = f(origin[0] + f(velocity[0] * delta));
  origin[1] = f(origin[1] + f(velocity[1] * delta));
  origin[2] = f(origin[2] + f(velocity[2] * delta));

  particle.color = context.colour;
  const axisScale = f((drawn.scale < 0 ? -1 : 1) * Math.max(Math.abs(drawn.scale), SCALE_FLOOR));
  for (const axis of particle.columns) scaleAxisInPlace(axis, axisScale);
}

/** One term of a `vec3` length, rounded to a float at each operation as the GPU rounds it. */
function lengthOf(x: number, y: number, z: number): number {
  return f(Math.sqrt(f(f(f(x * x) + f(y * y)) + f(z * z))));
}

/** The axis as a unit vector times `factor` (`sign(scale) * max(abs(scale), 0.001)`). */
function scaleAxisInPlace(axis: Float3, factor: number): void {
  const size = lengthOf(axis[0], axis[1], axis[2]);
  const divisor = size > 0 ? size : 1;
  axis[0] = f(f(axis[0] / divisor) * factor);
  axis[1] = f(f(axis[1] / divisor) * factor);
  axis[2] = f(f(axis[2] / divisor) * factor);
}
