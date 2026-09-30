/**
 * A job runner whose jobs finish only when a test says so, or when they are
 * aborted, as the real runner's are. `complete` answers with the bytes the real
 * job computes, so a test controls timing without faking pixels.
 */
import type { JobRunner } from '../resources/textures/proceduralBuilds';
import { WORKER_JOBS, type WorkerJobInput, type WorkerJobOutput } from './jobs';

export interface FakeJobRun {
  input: WorkerJobInput<'noise-texture-2d'>;
  signal: AbortSignal | undefined;
  complete(): void;
  resolve(output: WorkerJobOutput<'noise-texture-2d'>): void;
  reject(error: unknown): void;
}

export function fakeJobRunner(): { runner: JobRunner; runs: FakeJobRun[] } {
  const runs: FakeJobRun[] = [];
  const run = (_name: 'noise-texture-2d', input: WorkerJobInput<'noise-texture-2d'>, signal?: AbortSignal) =>
    new Promise<WorkerJobOutput<'noise-texture-2d'>>((resolve, reject) => {
      runs.push({
        input,
        signal,
        complete: () => resolve(WORKER_JOBS['noise-texture-2d'].run(input)),
        resolve,
        reject,
      });
      signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
  return { runner: { run: run as unknown as JobRunner['run'] }, runs };
}
