/**
 * `process()` of the generated particle shader (`particle_process_material.cpp:925-1160`): one
 * step of a live particle. The main velocity step of `particles.glsl` is off (`disable_velocity`),
 * so the position moves once, here.
 */

import { storedReal as f } from '../../../godot/math/real.js';
import type { ProcessSimulation } from '../../../resources/materials/particleprocessmaterial';
import { rotateHueInto } from '../cpuparticles/process';
import { add, cross, hasLength, normalize, scale, sub, type Float3 } from './float3';
import { drawParameters, seedOf } from './parameters';
import type { EmissionFrame, GpuParticle } from './particle';

/** What a step reads of the frame and of the emitter. */
export interface StepContext {
  simulation: ProcessSimulation;
  frame: EmissionFrame;
  amount: number;
  /** `params.lifetime`, a float. */
  lifetime: number;
  randomSeed: number;
}

/** The smallest axis scale, so that a scale of 0 still draws (`:1138-1145`). */
const SCALE_FLOOR = 0.001;

/** Steps `particle`, number `index` of the emitter, by `delta` seconds. */
export function stepParticle(
  particle: GpuParticle,
  index: number,
  delta: number,
  context: StepContext
): void {
  const { simulation, frame } = context;
  const number = (Math.imul(particle.cycle, context.amount) + index) >>> 0;
  const drawn = drawParameters(seedOf(number, context.randomSeed), simulation);

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

  particle.color = tinted(simulation);
  const [x, y, z] = particle.columns;
  particle.columns = [scaledAxis(x, drawn.scale), scaledAxis(y, drawn.scale), scaledAxis(z, drawn.scale)];
}

function tinted({ color }: ProcessSimulation): [number, number, number, number] {
  const rotated = rotateHueInto({ r: 0, g: 0, b: 0, a: 0 }, color, 0);
  return [rotated.r, rotated.g, rotated.b, rotated.a];
}

/** The axis as a unit vector times `sign(scale) * max(abs(scale), 0.001)`. */
function scaledAxis(column: Float3, factor: number): Float3 {
  const unit = hasLength(column) ? normalize(column) : column;
  const sign = factor < 0 ? -1 : 1;
  return scale(unit, f(sign * Math.max(Math.abs(factor), SCALE_FLOOR)));
}
