import type { CreateJobWorker, JobWorker } from './WorkerJobRunner';

/** Written once, by the first start: every later worker of the page starts from the same URL. */
let blobUrl: Promise<string> | undefined;

/** The loader calls it on its first job, and again after an abort terminates the worker. */
export const startBundledWorker: CreateJobWorker = async () => {
  // A dynamic import keeps the script out of the initial bundle until a job first needs it.
  blobUrl ??= import('virtual:texture-worker-source').then(({ default: source }) =>
    URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
  );
  return new Worker(await blobUrl) as unknown as JobWorker;
};
