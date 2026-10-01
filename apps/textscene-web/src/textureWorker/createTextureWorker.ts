/**
 * Starts the web previewer's job worker. The worker class is a dynamic import, so
 * its inlined script stays out of the initial bundle until a job first needs it.
 */
import type { CreateJobWorker, JobWorker } from '@textscene/core';

type WorkerClassModule = { default: new () => JobWorker };

const loadInlineWorker = (): Promise<WorkerClassModule> => import('./textureWorker?worker&inline');

/** The factory the loader calls on its first job, and again after an abort terminates the worker. `load` is replaceable for a test. */
export function textureWorkerFactory(
  load: () => Promise<WorkerClassModule> = loadInlineWorker
): CreateJobWorker {
  return async () => {
    const { default: TextureWorker } = await load();
    return new TextureWorker();
  };
}
