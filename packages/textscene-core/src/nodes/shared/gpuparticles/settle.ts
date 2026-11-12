/**
 * The pose a GPUParticles3D freezes at: the particles after the seconds the first frame spends
 * (`particles_storage.cpp:1542-1563`), as the shared particle buffer in node space. Pure: no
 * THREE and no React.
 *
 * Derived from Godot Engine (`servers/rendering/renderer_rd/storage_rd/particles_storage.cpp` and `servers/rendering/renderer_rd/shaders/particles_copy.glsl`), used
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
import {
  affineInverseTransform3D,
  identityTransform3D,
  multiplyTransform3D,
  type Transform3D,
} from '../../../godot/math/transform3d';
import { DEFAULT_PREVIEW_SEED, settleFrameTime, settleSeconds } from '../cpuparticles/process';
import { settleStepCount } from './settleLoop';
import {
  PARTICLE_COLOR_OFFSET,
  PARTICLE_CUSTOM_OFFSET,
  PARTICLE_FLOATS,
  writeTransformRows,
} from '../particles3d/particleBuffer';
import { EmissionShape } from '../../../godot/scene/particles3d';
import { birthParticle, type BirthContext } from './birth';
import type { GpuEmitter, GpuMaterial } from './emitter';
import { advanceClock, restartDelta, startClock } from './frames';
import type { Float3 } from './float3';
import { inactiveParticle, type EmissionFrame, type GpuParticle } from './particle';
import { stepContextOf, stepParticle } from './step';

export interface GpuSettleInput {
  emitter: GpuEmitter;
  material: GpuMaterial;
  /** The node's global transform: where a world-space particle starts. */
  emissionTransform: Transform3D;
}

export interface SettledGpuParticles {
  /** The live particles in index order, each {@link PARTICLE_FLOATS} floats, in node space. */
  buffer: Float32Array;
}

/**
 * The seconds of settle: the authored `preprocess` as the double the node holds, else the seconds
 * that stand for `--particles`, which reach the server as a `real_t`: 1.2 s as a float takes one
 * more step than 1.2 as a double.
 */
export function gpuSettleSeconds(emitter: GpuEmitter): number {
  const seconds = settleSeconds(emitter);
  return emitter.preprocess > 0 ? seconds : f(seconds);
}

/** The pose after `seconds` of settle: {@link gpuSettleSeconds} for an emitter, or the seconds a request names. */
export function settleGpuParticles(input: GpuSettleInput, seconds: number): SettledGpuParticles {
  const { emitter, material, emissionTransform } = input;
  const frame = emissionFrame(emitter.localCoords ? identityTransform3D() : emissionTransform);
  const randomSeed = emitter.useFixedSeed ? emitter.seed : DEFAULT_PREVIEW_SEED;
  const clock = startClock(emitter);
  if (drawsNothing(material)) return emptyPose();
  const frameTime = settleFrameTime(emitter);
  const steps = settleStepCount(Math.min(seconds, MAX_SETTLE_SECONDS), frameTime);
  const stride = particleStride(emitter.amount, steps);
  const particles = Array.from({ length: Math.ceil(emitter.amount / stride) }, inactiveParticle);
  const birth: BirthContext = {
    simulation: material.simulation,
    emission: material.emission,
    frame,
    amount: emitter.amount,
    amountRatio: f(emitter.amountRatio),
    randomSeed,
    cycle: 0,
  };
  const step = stepContextOf(material.simulation, frame, f(emitter.lifetime));

  for (let done = 0; done < steps; done++) {
    const frameParams = advanceClock(clock, emitter, frameTime);
    birth.cycle = frameParams.cycle;
    for (let slot = 0; slot < particles.length; slot++) {
      const particle = particles[slot]!;
      const index = slot * stride;
      const restartedDelta = restartDelta(index, emitter, frameParams);
      if (restartedDelta !== undefined) birthParticle(particle, index, birth);
      if (particle.active) stepParticle(particle, restartedDelta ?? frameParams.delta, step);
    }
  }
  return pose(particles, emitter.localCoords ? identityTransform3D() : emissionTransform);
}

/**
 * The most particle steps one settle runs: about a second of main thread. Each particle depends on its
 * own index only, so a larger emitter settles every `stride`-th particle exactly and draws a thinner cloud.
 */
/** The top of the range hint of `preprocess` (`gpu_particles_3d.cpp`). A hand-written scene may pass it; the settle stops there. */
const MAX_SETTLE_SECONDS = 600;

const MAX_PARTICLE_STEPS = 2_000_000;

function particleStride(amount: number, steps: number): number {
  return Math.max(1, Math.ceil((amount * steps) / MAX_PARTICLE_STEPS));
}

/** Points and directed points need the emission texture, which the previewer does not read yet. */
function drawsNothing({ emission }: GpuMaterial): boolean {
  return emission.shape === EmissionShape.POINTS || emission.shape === EmissionShape.DIRECTED_POINTS;
}

function emptyPose(): SettledGpuParticles {
  return { buffer: new Float32Array(0) };
}

function emissionFrame({ basis_x: x, basis_y: y, basis_z: z, origin }: Transform3D): EmissionFrame {
  const column = (axis: 'x' | 'y' | 'z'): Float3 => [x[axis], y[axis], z[axis]];
  return { columns: [column('x'), column('y'), column('z')], origin: [origin.x, origin.y, origin.z] };
}

/** The live particles as buffer rows in node space: a world-space particle goes back through the inverse of the emission transform. */
function pose(particles: GpuParticle[], emissionTransform: Transform3D): SettledGpuParticles {
  const live = particles.filter((particle) => particle.active);
  const buffer = new Float32Array(live.length * PARTICLE_FLOATS);
  const toNode = affineInverseTransform3D(emissionTransform);
  live.forEach((particle, index) => {
    writeTransformRows(
      buffer,
      index * PARTICLE_FLOATS,
      multiplyTransform3D(toNode, columnsToTransform(particle))
    );
    buffer.set(particle.color, index * PARTICLE_FLOATS + PARTICLE_COLOR_OFFSET);
    buffer.set(particle.custom, index * PARTICLE_FLOATS + PARTICLE_CUSTOM_OFFSET);
  });
  return { buffer };
}

function columnsToTransform({ columns: [x, y, z], origin }: GpuParticle): Transform3D {
  return {
    basis_x: { x: x[0], y: y[0], z: z[0] },
    basis_y: { x: x[1], y: y[1], z: z[1] },
    basis_z: { x: x[2], y: y[2], z: z[2] },
    origin: { x: origin[0], y: origin[1], z: origin[2] },
  };
}
