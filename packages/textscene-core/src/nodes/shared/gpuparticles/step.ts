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
import { add, cross, hasLength, normalize, scale, sub, type Float3 } from './float3';
import { tintedColour } from './parameters';
import type { EmissionFrame, GpuParticle } from './particle';

/** What a step reads of the frame and of the emitter. */
export interface StepContext {
  simulation: ProcessSimulation;
  frame: EmissionFrame;
  /** `params.lifetime`, a float. */
  lifetime: number;
}

/** The smallest axis scale, so that a scale of 0 still draws (`:1138-1145`). */
const SCALE_FLOOR = 0.001;

/** Steps `particle` by `delta` seconds, with the draws of its birth. */
export function stepParticle(particle: GpuParticle, delta: number, context: StepContext): void {
  const { simulation, frame } = context;
  const { drawn } = particle;
  if (!drawn) return;

  const age = f(particle.custom[1] + f(delta / context.lifetime));
  particle.custom[1] = age;
  if (age > particle.custom[3]) particle.active = false;

  const gravity: Float3 = [simulation.gravity.x, simulation.gravity.y, simulation.gravity.z];
  let force = gravity;
  if (hasLength(particle.velocity))
    force = add(force, scale(normalize(particle.velocity), drawn.linearAccel));
  const offset = sub(particle.origin, frame.origin);
  if (hasLength(offset)) force = add(force, scale(normalize(offset), drawn.radialAccel));
  // `cross(normalize(diff), normalize(gravity))` is NaN without a diff or a gravity: no force.
  const around = cross(normalize(offset), normalize(gravity));
  if (hasLength(around)) force = add(force, scale(normalize(around), drawn.tangentialAccel));

  particle.velocity = add(particle.velocity, scale(force, delta));
  particle.origin = add(particle.origin, scale(particle.velocity, delta));

  particle.color = tintedColour(simulation);
  const [x, y, z] = particle.columns;
  particle.columns = [scaledAxis(x, drawn.scale), scaledAxis(y, drawn.scale), scaledAxis(z, drawn.scale)];
}

/** The axis as a unit vector times `sign(scale) * max(abs(scale), 0.001)`. */
function scaledAxis(column: Float3, factor: number): Float3 {
  const unit = hasLength(column) ? normalize(column) : column;
  const sign = factor < 0 ? -1 : 1;
  return scale(unit, f(sign * Math.max(Math.abs(factor), SCALE_FLOOR)));
}
