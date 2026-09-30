/**
 * The entry a host's job-worker script imports. It carries the jobs and nothing
 * of the renderer: `workers/workerClosure.test.ts` keeps three and react out.
 */
export { installWorkerJobs, type WorkerJobScope } from './workers/workerEntry';
