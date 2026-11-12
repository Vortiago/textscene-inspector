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
import {
  PARTICLE_COLOR_OFFSET,
  PARTICLE_CUSTOM_OFFSET,
  PARTICLE_FLOATS,
} from '../particles3d/particleBuffer';
import { EmissionShape } from '../../../godot/scene/particles3d';
import { birthParticle, type BirthContext } from './birth';
import type { GpuEmitter, GpuMaterial } from './emitter';
import { advanceClock, restartOf, startClock } from './frames';
import type { Float3 } from './float3';
import { inactiveParticle, type EmissionFrame, type GpuParticle } from './particle';
import { stepParticle, type StepContext } from './step';

export interface GpuSettleInput {
  emitter: GpuEmitter;
  material: GpuMaterial;
  /** The node's global transform: where a world-space particle starts. */
  emissionTransform: Transform3D;
}

export interface SettledGpuParticles {
  /** The live particles in index order, each {@link PARTICLE_FLOATS} floats, in node space. */
  buffer: Float32Array;
  /** Three floats for each live particle: `Y_TO_VELOCITY` reads them. */
  velocity: Float32Array;
  /** The system phase after the last step: the `LIFETIME` draw order reads it. */
  phase: number;
}

/** Ceiling on settle steps, as for the CPU settle: a huge `preprocess` would spin for minutes. */
const MAX_SETTLE_STEPS = 4096;

/**
 * The seconds of settle: the authored `preprocess` as the double the node holds, else the seconds
 * that stand for `--particles`, which reach the server as a `real_t`: 1.2 s as a float takes one
 * more step than 1.2 as a double.
 */
export function gpuSettleSeconds(emitter: GpuEmitter): number {
  const seconds = settleSeconds(emitter);
  return emitter.preprocess > 0 ? seconds : f(seconds);
}

/** The frame times the first frame steps: `while (todo >= 0)` overshoots the last step (`:1559-1563`). */
export function settleFrameDeltas(seconds: number, frameTime: number): number[] {
  const deltas: number[] = [];
  for (let todo = seconds; todo >= 0 && deltas.length < MAX_SETTLE_STEPS; todo -= frameTime) {
    deltas.push(frameTime);
  }
  return deltas;
}

export function settleGpuParticles(input: GpuSettleInput): SettledGpuParticles {
  return settleFor(input, gpuSettleSeconds(input.emitter));
}

/** {@link settleGpuParticles} at an explicit number of seconds. */
export function settleFor(input: GpuSettleInput, seconds: number): SettledGpuParticles {
  const { emitter, material, emissionTransform } = input;
  const frame = emissionFrame(emitter.localCoords ? identityTransform3D() : emissionTransform);
  const randomSeed = emitter.useFixedSeed ? emitter.seed : DEFAULT_PREVIEW_SEED;
  const clock = startClock(emitter);
  const particles = Array.from({ length: emitter.amount }, inactiveParticle);
  const birth: BirthContext = {
    simulation: material.simulation,
    emission: material.emission,
    frame,
    amount: emitter.amount,
    amountRatio: f(emitter.amountRatio),
    randomSeed,
    cycle: 0,
  };
  const step: StepContext = {
    simulation: material.simulation,
    frame,
    amount: emitter.amount,
    lifetime: f(emitter.lifetime),
    randomSeed,
  };

  if (drawsNothing(material)) return emptyPose(clock.phase);
  for (const delta of settleFrameDeltas(seconds, settleFrameTime(emitter))) {
    const frameParams = advanceClock(clock, emitter, delta);
    birth.cycle = frameParams.cycle;
    particles.forEach((particle, index) => {
      const restart = restartOf(index, emitter, frameParams);
      let localDelta = frameParams.delta;
      if (restart.restarts) {
        birthParticle(particle, index, birth);
        localDelta = restart.localDelta;
      }
      if (particle.active) stepParticle(particle, index, localDelta, step);
    });
  }
  return pose(particles, clock.phase, emitter.localCoords ? identityTransform3D() : emissionTransform);
}

/** Points and directed points need the emission texture, which #1158 owns. */
function drawsNothing({ emission }: GpuMaterial): boolean {
  return emission.shape === EmissionShape.POINTS || emission.shape === EmissionShape.DIRECTED_POINTS;
}

function emptyPose(phase: number): SettledGpuParticles {
  return { buffer: new Float32Array(0), velocity: new Float32Array(0), phase };
}

function emissionFrame({ basis_x: x, basis_y: y, basis_z: z, origin }: Transform3D): EmissionFrame {
  const column = (axis: 'x' | 'y' | 'z'): Float3 => [x[axis], y[axis], z[axis]];
  return { columns: [column('x'), column('y'), column('z')], origin: [origin.x, origin.y, origin.z] };
}

/** The live particles as buffer rows in node space: a world-space particle goes back through the inverse of the emission transform. */
function pose(particles: GpuParticle[], phase: number, emissionTransform: Transform3D): SettledGpuParticles {
  const live = particles.filter((particle) => particle.active);
  const buffer = new Float32Array(live.length * PARTICLE_FLOATS);
  const velocity = new Float32Array(live.length * 3);
  const toNode = affineInverseTransform3D(emissionTransform);
  live.forEach((particle, index) => {
    writeRows(buffer, index * PARTICLE_FLOATS, particle, toNode);
    buffer.set(particle.color, index * PARTICLE_FLOATS + PARTICLE_COLOR_OFFSET);
    buffer.set(particle.custom, index * PARTICLE_FLOATS + PARTICLE_CUSTOM_OFFSET);
    velocity.set(particle.velocity, index * 3);
  });
  return { buffer, velocity, phase };
}

/** Writes the 3×4 rows of `toNode * particle`. */
function writeRows(buffer: Float32Array, at: number, particle: GpuParticle, toNode: Transform3D): void {
  const world = columnsToTransform(particle);
  const node = multiplyTransform3D(toNode, world);
  const rows = [node.basis_x, node.basis_y, node.basis_z];
  rows.forEach((row, r) => {
    buffer[at + r * 4] = row.x;
    buffer[at + r * 4 + 1] = row.y;
    buffer[at + r * 4 + 2] = row.z;
  });
  buffer[at + 3] = node.origin.x;
  buffer[at + 7] = node.origin.y;
  buffer[at + 11] = node.origin.z;
}

function columnsToTransform({ columns: [x, y, z], origin }: GpuParticle): Transform3D {
  return {
    basis_x: { x: x[0], y: y[0], z: z[0] },
    basis_y: { x: x[1], y: y[1], z: z[1] },
    basis_z: { x: x[2], y: y[2], z: z[2] },
    origin: { x: origin[0], y: origin[1], z: origin[2] },
  };
}
