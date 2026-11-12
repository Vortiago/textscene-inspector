/**
 * `start()` of the generated particle shader (`particle_process_material.cpp:900-950`): where a
 * restarting particle sits, how fast it moves and what colour it takes, off its own seed.
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
import { EmissionShape } from '../../../godot/scene/particles3d';
import type { ParticleEmission } from '../../../resources/materials/particleprocessmaterial/types';
import type { ProcessSimulation } from '../../../resources/materials/particleprocessmaterial';
import { rotateHueInto } from '../cpuparticles/process';
import { randFromSeed, type SeedRef } from '../cpuparticles/godotRng';
import { add, cross, hasLength, length, mix, mixVector, normalize, scale, type Float3 } from './float3';
import { DEGREE_TO_RAD, SHADER_PI, drawParameters, seedOf, type DrawnParameters } from './parameters';
import type { EmissionFrame, GpuParticle } from './particle';

/** What a birth reads of the frame it happens in. */
export interface BirthContext {
  simulation: ProcessSimulation;
  emission: ParticleEmission;
  frame: EmissionFrame;
  amount: number;
  amountRatio: number;
  randomSeed: number;
  cycle: number;
}

/** A transformed direction: `EMISSION_TRANSFORM * vec4(v, 0.0)`. */
export function frameDirection(frame: EmissionFrame, v: Float3): Float3 {
  const [x, y, z] = frame.columns;
  return add(add(scale(x, v[0]), scale(y, v[1])), scale(z, v[2]));
}

/** A transformed point: `EMISSION_TRANSFORM * vec4(v, 1.0)`. */
export function framePoint(frame: EmissionFrame, v: Float3): Float3 {
  return add(frameDirection(frame, v), frame.origin);
}

/**
 * Restarts `particle` as particle `index`. A particle whose `amount_ratio` draw is above the ratio
 * is born inactive (`:873-875`).
 */
export function birthParticle(particle: GpuParticle, index: number, context: BirthContext): void {
  const { simulation, emission, frame } = context;
  particle.cycle = context.cycle & 0xffff;
  const number = (Math.imul(particle.cycle, context.amount) + index) >>> 0;
  const seed = seedOf(number, context.randomSeed);
  const drawn = drawParameters(seed, simulation);

  particle.active = randFromSeed(seed) <= context.amountRatio;
  particle.custom = [0, 0, 0, drawn.lifetimeShare];
  particle.color = startColour(simulation);
  particle.columns = [frame.columns[0], frame.columns[1], frame.columns[2]];
  particle.origin = framePoint(frame, shapePosition(emission, seed));
  particle.velocity = frameDirection(frame, startVelocity(simulation, drawn, seed));
}

/** `rotate_hue(color_value, 0.0)`, which tints even at an angle of 0. */
function startColour({ color }: ProcessSimulation): [number, number, number, number] {
  const rotated = rotateHueInto({ r: 0, g: 0, b: 0, a: 0 }, color, 0);
  return [rotated.r, rotated.g, rotated.b, rotated.a];
}

function startVelocity(simulation: ProcessSimulation, drawn: DrawnParameters, seed: SeedRef): Float3 {
  return scale(spreadDirection(simulation, seed), drawn.initialVelocity);
}

/** `rand_from_seed_m1_p1`. */
function signedDraw(seed: SeedRef): number {
  return f(f(randFromSeed(seed) * 2) - 1);
}

/** `get_random_direction_from_spread` for 3D (`:782-812`). */
function spreadDirection({ direction, spread, flatness }: ProcessSimulation, seed: SeedRef): Float3 {
  const spreadRad = f(spread * DEGREE_TO_RAD);
  const angle1 = f(signedDraw(seed) * spreadRad);
  const angle2 = f(f(signedDraw(seed) * spreadRad) * f(1 - flatness));
  const yzDepth = f(Math.cos(angle2));
  const widenedDepth = f(yzDepth / Math.max(0.0001, f(Math.sqrt(Math.abs(yzDepth)))));
  const spreadVector: Float3 = [
    f(f(Math.sin(angle1)) * widenedDepth),
    f(Math.sin(angle2)),
    f(f(Math.cos(angle1)) * widenedDepth),
  ];

  const axis: Float3 = [direction.x, direction.y, direction.z];
  const forward: Float3 = hasLength(axis) ? normalize(axis) : [0, 0, 1];
  const tilted = cross([0, 1, 0], forward);
  const binormal = normalize(length(tilted) < 0.0001 ? [0, 0, 1] : tilted);
  const normal = cross(binormal, forward);
  return normalize(
    add(
      add(scale(binormal, spreadVector[0]), scale(normal, spreadVector[1])),
      scale(forward, spreadVector[2])
    )
  );
}

/** `calculate_initial_position`: the shape's draw, scaled, then moved by the offset (`:561-704`). */
function shapePosition(emission: ParticleEmission, seed: SeedRef): Float3 {
  const position = shapeDraw(emission, seed);
  const { shapeScale: s, shapeOffset: o } = emission;
  return [f(f(position[0] * s.x) + o.x), f(f(position[1] * s.y) + o.y), f(f(position[2] * s.z) + o.z)];
}

function shapeDraw(emission: ParticleEmission, seed: SeedRef): Float3 {
  const radius = emission.sphereRadius;
  switch (emission.shape) {
    case EmissionShape.SPHERE: {
      const [x, y, z] = sphereSurface(radius, seed);
      return mixVector([0, 0, 0], [x, y, z], randFromSeed(seed));
    }
    case EmissionShape.SPHERE_SURFACE:
      return sphereSurface(radius, seed);
    case EmissionShape.BOX: {
      const { boxExtents: e } = emission;
      return [f(signedDraw(seed) * e.x), f(signedDraw(seed) * e.y), f(signedDraw(seed) * e.z)];
    }
    case EmissionShape.RING:
      return ringPosition(emission, seed);
    default:
      return [0, 0, 0];
  }
}

/** The sphere's surface point of the two draws `s` and `t`; the SPHERE shape then mixes by a third. */
function sphereSurface(radius: number, seed: SeedRef): Float3 {
  const s = signedDraw(seed);
  const t = f(f(randFromSeed(seed) * 2) * SHADER_PI);
  const ringRadius = f(radius * f(Math.sqrt(f(1 - f(s * s)))));
  return [f(ringRadius * f(Math.cos(t))), f(ringRadius * f(Math.sin(t))), f(radius * s)];
}

function ringPosition(emission: ParticleEmission, seed: SeedRef): Float3 {
  const { ringAxis, ringHeight: height, ringInnerRadius: inner, ringConeAngle } = emission;
  const clamped = Math.max(0.001, emission.ringRadius);
  const radiansOf90 = f(f(90 - ringConeAngle) * f(Math.PI / 180));
  const topRadius = Math.max(f(clamped - f(f(Math.tan(radiansOf90)) * height)), 0);
  const heightDraw = randFromSeed(seed);
  const skew = Math.max(f(Math.min(clamped, topRadius) / Math.max(clamped, topRadius)), 0.5);
  const y = clamped < topRadius ? f(heightDraw ** skew) : f(1 - f(heightDraw ** skew));
  const angle = f(f(randFromSeed(seed) * 2) * SHADER_PI);
  const innerSquared = f(inner * inner);
  const spread = f(f(randFromSeed(seed) * f(f(clamped * clamped) - innerSquared)) + innerSquared);
  const baseRadius = f(Math.sqrt(spread));
  const randomRadius = mix(baseRadius, f(baseRadius * f(topRadius / clamped)), y);

  const axis = normalize(
    hasLength([ringAxis.x, ringAxis.y, ringAxis.z]) ? [ringAxis.x, ringAxis.y, ringAxis.z] : [0, 0, 1]
  );
  const isXAxis = Math.abs(axis[0]) === 1 && axis[1] === 0 && axis[2] === 0;
  const orthogonal = normalize(isXAxis ? cross(axis, [0, 1, 0]) : cross(axis, [1, 0, 0]));
  const turned = normalize(rotateAbout(axis, angle, orthogonal));
  const alongAxis = scale(axis, f(f(y * height) - f(height / 2)));
  return add(scale(turned, randomRadius), alongAxis);
}

/** The `mat3(…) * ortho_axis` of the ring: `v` turned by `angle` about the unit `axis`. */
function rotateAbout(axis: Float3, angle: number, v: Float3): Float3 {
  const s = f(Math.sin(angle));
  const c = f(Math.cos(angle));
  const oc = f(1 - c);
  const [x, y, z] = axis;
  const column0: Float3 = [
    f(c + f(f(x * x) * oc)),
    f(f(f(x * y) * oc) - f(z * s)),
    f(f(f(x * z) * oc) + f(y * s)),
  ];
  const column1: Float3 = [
    f(f(f(x * y) * oc) + f(s * z)),
    f(c + f(f(y * y) * oc)),
    f(f(f(y * z) * oc) - f(x * s)),
  ];
  const column2: Float3 = [
    f(f(f(z * x) * oc) - f(y * s)),
    f(f(f(z * y) * oc) + f(x * s)),
    f(c + f(f(z * z) * oc)),
  ];
  return add(add(scale(column0, v[0]), scale(column1, v[1])), scale(column2, v[2]));
}
