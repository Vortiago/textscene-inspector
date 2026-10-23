/**
 * The jobs a worker runs: pure functions from a structured-clone input to an
 * output whose buffers transfer back. The in-thread fallback runs the same
 * functions, so both paths give the same bytes (ADR-0042).
 */

import { noiseTexture2DLevels, type NoiseTexture2DInput } from '../resources/textures/noisetexture2d/pixels';
import type { MipLevel } from '../resources/processing/mipChain';
import { noiseTexture3DTexels, type NoiseTexture3DInput } from '../resources/textures/noisetexture3d/texels';

export interface WorkerJob<Input, Output> {
  run(input: Input): Output;
  /** The buffers the reply hands over instead of copying. */
  transfer(output: Output): Transferable[];
}

interface LevelsOutput {
  levels: MipLevel[];
}

interface TexelsOutput {
  texels: Uint8Array;
}

export const WORKER_JOBS = {
  'noise-texture-2d': {
    run: (input: NoiseTexture2DInput): LevelsOutput => ({ levels: noiseTexture2DLevels(input) }),
    transfer: (output: LevelsOutput) => output.levels.map(({ data }) => data.buffer),
  },
  'noise-texture-3d': {
    run: (input: NoiseTexture3DInput): TexelsOutput => ({ texels: noiseTexture3DTexels(input) }),
    transfer: (output: TexelsOutput) => [output.texels.buffer],
  },
} satisfies Record<string, WorkerJob<never, unknown>>;

export type WorkerJobName = keyof typeof WORKER_JOBS;
export type WorkerJobInput<Name extends WorkerJobName> = Parameters<(typeof WORKER_JOBS)[Name]['run']>[0];
export type WorkerJobOutput<Name extends WorkerJobName> = ReturnType<(typeof WORKER_JOBS)[Name]['run']>;

export function isWorkerJobName(name: string): name is WorkerJobName {
  return Object.hasOwn(WORKER_JOBS, name);
}
