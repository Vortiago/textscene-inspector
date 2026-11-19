import { memoisedImport } from '../resources/memoisedImport';
import type { CreateJobWorker, JobWorker } from './WorkerJobRunner';

/** Imported on the first job, so the initial bundle holds no script. One URL serves every worker. */
const blobUrl = memoisedImport(() =>
  import('virtual:texture-worker-source').then(({ default: source }) =>
    URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
  )
);

/** The loader calls it on its first job, and again after an abort terminates the worker. */
export const startBundledWorker: CreateJobWorker = async () =>
  new Worker(await blobUrl()) as unknown as JobWorker;
