/**
 * Starts the webview's job worker from a blob URL of its bundled source: the CSP
 * admits `worker-src blob:` and nothing that fetches (ADR-0042). The source is a
 * dynamic import, so it stays out of the initial bundle until a job first needs it.
 */
import type { CreateJobWorker, JobWorker } from '@textscene/core';

type WorkerSourceModule = { default: string };

const loadBundledSource = (): Promise<WorkerSourceModule> => import('virtual:texture-worker-source');

/** The factory the loader calls on its first job, and again after an abort terminates the worker. */
export function textureWorkerFactory(
  load: () => Promise<WorkerSourceModule> = loadBundledSource
): CreateJobWorker {
  let blobUrl: Promise<string> | undefined;
  return async () => {
    blobUrl ??= load().then(({ default: source }) =>
      URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
    );
    return new Worker(await blobUrl) as unknown as JobWorker;
  };
}
