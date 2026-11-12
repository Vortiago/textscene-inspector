/** An emitter and a ParticleProcessMaterial built from the properties a scene writes, for the settle tests. */

import { identityTransform3D, type Transform3D } from '../../../godot/math/transform3d';
import { PARTICLE_FLOATS } from '../particles3d/particleBuffer';
import { decodeParticleProcessMaterial } from '../../../resources/materials/particleprocessmaterial/decode';
import { decodeProcessSimulation } from '../../../resources/materials/particleprocessmaterial/simulation';
import type { GpuEmitter } from './emitter';
import { settleGpuParticles } from './settle';

/** The constructor's values (`gpu_particles_3d.cpp:878-904`), with one particle so a test follows it. */
const EMITTER: GpuEmitter = {
  emitting: true,
  amount: 1,
  amountRatio: 1,
  lifetime: 2,
  oneShot: false,
  preprocess: 1.2,
  explosiveness: 0,
  randomness: 0,
  fixedFps: 30,
  fractDelta: true,
  localCoords: false,
  useFixedSeed: true,
  seed: 0,
  speedScale: 1,
};

/** The case of the Godot measurement most rows share. */
export const BASE_MATERIAL: Record<string, string> = {
  direction: 'Vector3(0, 1, 0)',
  spread: '45',
  initial_velocity_min: '2',
  initial_velocity_max: '3',
  gravity: 'Vector3(0, -2, 0)',
};

export function settle(
  emitter: Partial<GpuEmitter>,
  material: Record<string, string> = BASE_MATERIAL,
  emissionTransform: Transform3D = identityTransform3D()
) {
  return settleGpuParticles({
    emitter: { ...EMITTER, ...emitter },
    material: {
      emission: decodeParticleProcessMaterial(material),
      simulation: decodeProcessSimulation(material),
    },
    emissionTransform,
  });
}

/** Particle `index`'s origin in the buffer, row by row. */
export function originOf(buffer: Float32Array, index = 0): [number, number, number] {
  const at = index * PARTICLE_FLOATS;
  return [buffer[at + 3]!, buffer[at + 7]!, buffer[at + 11]!];
}

/** The input {@link settle} builds, for a test that calls a lower-level entry. */
export function requestInput(
  emitter: Partial<GpuEmitter> = {},
  material: Record<string, string> = BASE_MATERIAL
) {
  return {
    emitter: { ...EMITTER, preprocess: 0, ...emitter },
    material: {
      emission: decodeParticleProcessMaterial(material),
      simulation: decodeProcessSimulation(material),
    },
    emissionTransform: identityTransform3D(),
  };
}
