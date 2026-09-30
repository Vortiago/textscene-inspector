/**
 * The jobs a worker runs: pure functions from a structured-clone input to an
 * output whose buffers transfer back. The in-thread fallback runs the same
 * functions, so both paths give the same bytes (ADR-0042).
 */

import { noiseTexture2DPixels, type NoiseTexture2DInput } from '../resources/textures/noisetexture2d/pixels';

export interface WorkerJob<Input, Output> {
  run(input: Input): Output;
  /** The buffers the reply hands over instead of copying. */
  transfer(output: Output): Transferable[];
}

export interface PixelsOutput {
  pixels: Uint8Array;
}

export const WORKER_JOBS = {
  'noise-texture-2d': {
    run: (input: NoiseTexture2DInput): PixelsOutput => ({ pixels: noiseTexture2DPixels(input) }),
    transfer: (output: PixelsOutput) => [output.pixels.buffer],
  },
} satisfies Record<string, WorkerJob<never, unknown>>;

export type WorkerJobName = keyof typeof WORKER_JOBS;
export type WorkerJobInput<Name extends WorkerJobName> = Parameters<(typeof WORKER_JOBS)[Name]['run']>[0];
export type WorkerJobOutput<Name extends WorkerJobName> = ReturnType<(typeof WORKER_JOBS)[Name]['run']>;

export function isWorkerJobName(name: string): name is WorkerJobName {
  return Object.hasOwn(WORKER_JOBS, name);
}
