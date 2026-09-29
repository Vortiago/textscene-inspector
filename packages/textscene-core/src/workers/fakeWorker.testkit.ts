/**
 * A worker double for runner tests: it holds each posted request until the test
 * calls `respond`, then answers through the real worker entry, so a test controls
 * when a job finishes and still gets the bytes the real job computes.
 */
import { installWorkerJobs } from './workerEntry';
import type { JobWorker } from './WorkerJobRunner';

type Listener = (event: { data?: unknown; message?: string }) => void;

export class FakeWorker implements JobWorker {
  readonly held: unknown[] = [];
  terminated = false;
  private readonly listeners = { message: [] as Listener[], error: [] as Listener[] };
  private readonly answer: (data: unknown) => void;

  constructor() {
    let workerSide: ((event: { data: unknown }) => void) | undefined;
    installWorkerJobs({
      addEventListener: (_type, listener) => {
        workerSide = listener;
      },
      postMessage: (message) => this.emit('message', { data: message }),
    });
    this.answer = (data) => workerSide?.({ data });
  }

  addEventListener(type: 'message' | 'error', listener: Listener): void {
    this.listeners[type].push(listener);
  }

  postMessage(message: unknown): void {
    this.held.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  /** Answers the oldest held request. */
  respond(): void {
    const next = this.held.shift();
    if (next === undefined) throw new Error('expected a held request to answer, found none');
    this.answer(next);
  }

  /** Raises the `error` event a worker fires when its script cannot start. */
  fail(message: string): void {
    this.emit('error', { message });
  }

  private emit(type: 'message' | 'error', event: { data?: unknown; message?: string }): void {
    for (const listener of this.listeners[type]) listener(event);
  }
}
