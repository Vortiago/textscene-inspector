/**
 * The page side of the job protocol. One worker, started on the first job,
 * serves jobs in order. When a host gives no worker, or its worker cannot start,
 * the runner runs the same jobs in-thread, so the bytes never depend on which
 * path ran them (ADR-0042).
 */

import { warn } from '../logger.js';
import {
  WORKER_JOBS,
  type WorkerJob,
  type WorkerJobInput,
  type WorkerJobName,
  type WorkerJobOutput,
} from './jobs';
import { fromJobError, type WorkerJobReply, type WorkerJobRequest } from './protocol';

/** The part of a `Worker` the runner uses, so a test can stand in for one. */
export interface JobWorker {
  addEventListener(
    type: 'message' | 'error',
    listener: (event: { data?: unknown; message?: string }) => void
  ): void;
  postMessage(message: WorkerJobRequest): void;
  terminate(): void;
}

/** How a host starts its job worker. It may throw or reject, and the runner then falls back. */
export type CreateJobWorker = () => JobWorker | Promise<JobWorker>;

interface QueuedJob {
  id: number;
  name: WorkerJobName;
  input: unknown;
  signal: AbortSignal | undefined;
  resolve: (output: unknown) => void;
  reject: (error: unknown) => void;
  onAbort: () => void;
  settled: boolean;
  /** Set while the job waits for its in-thread turn. */
  timer?: ReturnType<typeof setTimeout>;
}

function abortError(): DOMException {
  return new DOMException('The worker job was aborted', 'AbortError');
}

export class WorkerJobRunner {
  private readonly createWorker: CreateJobWorker | undefined;
  /** Written by `acquireWorker`. Cleared by an abort, a worker error and `dispose`. */
  private worker: Promise<JobWorker> | null = null;
  private liveWorker: JobWorker | null = null;
  /** Set once, for good, by the first failure to start a worker. */
  private inThread: boolean;
  private readonly queue: QueuedJob[] = [];
  private running: QueuedJob | null = null;
  private nextId = 1;

  constructor(options: { createWorker?: CreateJobWorker } = {}) {
    this.createWorker = options.createWorker;
    this.inThread = !options.createWorker;
  }

  run<Name extends WorkerJobName>(
    name: Name,
    input: WorkerJobInput<Name>,
    signal?: AbortSignal
  ): Promise<WorkerJobOutput<Name>> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(abortError());
        return;
      }
      const job: QueuedJob = {
        id: this.nextId++,
        name,
        input,
        signal,
        resolve: resolve as (output: unknown) => void,
        reject,
        onAbort: () => this.abort(job),
        settled: false,
      };
      signal?.addEventListener('abort', job.onAbort, { once: true });
      this.queue.push(job);
      this.pump();
    });
  }

  /** Aborts every job and stops the worker. The runner starts a new one for a later job. */
  dispose(): void {
    for (const job of [...this.queue]) this.abort(job);
    if (this.running) this.abort(this.running);
    this.stopWorker();
  }

  private pump(): void {
    if (this.running) return;
    const job = this.queue.shift();
    if (!job) return;
    this.running = job;
    if (this.inThread) this.runInThread(job);
    else void this.runInWorker(job);
  }

  private runInThread(job: QueuedJob): void {
    // A later task, not now: the caller's render finishes first, and an abort
    // before the task runs skips the work.
    job.timer = setTimeout(() => {
      job.timer = undefined;
      try {
        const entry = WORKER_JOBS[job.name] as WorkerJob<unknown, unknown>;
        this.finish(job, () => job.resolve(entry.run(job.input)));
      } catch (error) {
        this.finish(job, () => job.reject(error));
      }
    }, 0);
  }

  private async runInWorker(job: QueuedJob): Promise<void> {
    let worker: JobWorker;
    try {
      worker = await this.acquireWorker();
    } catch (error) {
      // An aborted job's worker was stopped on purpose, which is no reason to fall back.
      if (job.settled) return;
      this.fallBack(error);
      this.runInThread(job);
      return;
    }
    if (job.settled) return;
    worker.postMessage({ id: job.id, job: job.name, input: job.input });
  }

  private acquireWorker(): Promise<JobWorker> {
    if (!this.worker) {
      const create = this.createWorker;
      if (!create) return Promise.reject(new Error('no worker factory'));
      const starting: Promise<JobWorker> = Promise.resolve()
        .then(create)
        .then((worker) => {
          // Stopped while it started: nothing will post to it, so it must not outlive the stop.
          if (this.worker !== starting) {
            worker.terminate();
            throw abortError();
          }
          worker.addEventListener('message', ({ data }) => this.onReply(worker, data));
          worker.addEventListener('error', ({ message }) => this.onWorkerError(worker, message));
          this.liveWorker = worker;
          return worker;
        });
      this.worker = starting;
    }
    return this.worker;
  }

  private onReply(worker: JobWorker, data: unknown): void {
    const job = this.running;
    const reply = data as WorkerJobReply;
    if (worker !== this.liveWorker || !job || job.id !== reply.id) return;
    if (reply.ok) this.finish(job, () => job.resolve(reply.output));
    else this.finish(job, () => job.reject(fromJobError(reply.error)));
  }

  /** A worker that fails to load raises `error` and never answers, so its job re-runs in-thread. */
  private onWorkerError(worker: JobWorker, message: string | undefined): void {
    if (worker !== this.liveWorker) return;
    this.stopWorker();
    this.fallBack(message ?? 'worker error');
    if (this.running) this.runInThread(this.running);
  }

  private fallBack(reason: unknown): void {
    if (this.inThread) return;
    this.inThread = true;
    warn(`[WorkerJobRunner] No job worker (${String(reason)}); running jobs on the main thread`);
  }

  private abort(job: QueuedJob): void {
    if (job.settled) return;
    const queued = this.queue.indexOf(job);
    if (queued >= 0) this.queue.splice(queued, 1);
    if (job === this.running) {
      if (job.timer !== undefined) clearTimeout(job.timer);
      // Terminating is the only way to stop a job mid-run, and it frees its buffers.
      else this.stopWorker();
    }
    this.finish(job, () => job.reject(abortError()));
  }

  private stopWorker(): void {
    this.liveWorker?.terminate();
    this.liveWorker = null;
    this.worker = null;
  }

  private finish(job: QueuedJob, settle: () => void): void {
    job.settled = true;
    job.signal?.removeEventListener('abort', job.onAbort);
    if (this.running === job) this.running = null;
    settle();
    this.pump();
  }
}

/** A runner with no worker, for a caller outside any host: its jobs run on the main thread. */
export const inThreadJobRunner = new WorkerJobRunner();
