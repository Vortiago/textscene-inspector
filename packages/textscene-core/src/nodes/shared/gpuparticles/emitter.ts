/**
 * What the GPU simulation reads of a GPUParticles3D and of its ParticleProcessMaterial. Every
 * default is the node constructor's (`gpu_particles_3d.cpp:878-904`), set by the parse.
 */

import type { ProcessMaterial } from '../../../resources/materials/particleprocessmaterial';

export interface GpuEmitter {
  emitting: boolean;
  amount: number;
  /** `amount_ratio`: the share of particles that live. */
  amountRatio: number;
  lifetime: number;
  oneShot: boolean;
  /** Seconds the first frame spends, in a double (`particles_storage.cpp:1542-1544`). */
  preprocess: number;
  explosiveness: number;
  randomness: number;
  fixedFps: number;
  /** `fract_delta`: a particle born mid-step gets only the rest of the step. */
  fractDelta: boolean;
  localCoords: boolean;
  useFixedSeed: boolean;
  seed: number;
}

export type GpuMaterial = ProcessMaterial;
