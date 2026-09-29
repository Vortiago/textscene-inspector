/**
 * The worker side of the job protocol. A host's worker script calls
 * {@link installWorkerJobs} on its global scope, and nothing else.
 */

import { isWorkerJobName, WORKER_JOBS, type WorkerJob } from './jobs';
import { readJobRequest, toJobError, type WorkerJobReply } from './protocol';

/**
 * The part of a worker's global scope the protocol uses. It is structural, so
 * core compiles against the DOM library and a host casts `self` in one line.
 */
export interface WorkerJobScope {
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  postMessage(message: WorkerJobReply, transfer: Transferable[]): void;
}

export function installWorkerJobs(scope: WorkerJobScope): void {
  scope.addEventListener('message', ({ data }) => {
    const request = readJobRequest(data);
    if (!request) return;
    const { id, job, input } = request;
    if (!isWorkerJobName(job)) {
      scope.postMessage({ id, ok: false, error: toJobError(new Error(`unknown worker job "${job}"`)) }, []);
      return;
    }
    // The registry's per-job types meet the untyped message here, once.
    const entry = WORKER_JOBS[job] as WorkerJob<unknown, unknown>;
    try {
      const output = entry.run(input);
      scope.postMessage({ id, ok: true, output }, entry.transfer(output));
    } catch (error) {
      scope.postMessage({ id, ok: false, error: toJobError(error) }, []);
    }
  });
}
