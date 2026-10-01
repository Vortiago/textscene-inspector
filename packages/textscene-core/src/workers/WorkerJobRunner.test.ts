/**
 * The page side of the job protocol: one lazily started worker serves jobs in
 * order, an abort drops or terminates its job, and any failure to start a worker
 * falls back to running the same job in-thread.
 */
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../logger';
import {
  NOISE_PIXEL_CASES,
  PINNED_PIXEL_HASHES,
} from '../resources/textures/noisetexture2d/pixelCases.testkit';
import { FakeWorker } from './fakeWorker.testkit';
import { WORKER_JOBS } from './jobs';
import { WorkerJobRunner } from './WorkerJobRunner';

const [firstCase, secondCase] = NOISE_PIXEL_CASES;
if (!firstCase || !secondCase) throw new Error('expected at least two noise pixel cases');

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** Lets pending promise callbacks and timers run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
});

/** A runner over fake workers, and every worker it has started. */
function runnerWithFakes() {
  const workers: FakeWorker[] = [];
  const runner = new WorkerJobRunner({
    createWorker: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
  });
  return { runner, workers };
}

describe('WorkerJobRunner through a worker', () => {
  it('resolves a job with the bytes the job computes', async () => {
    const { runner, workers } = runnerWithFakes();
    const result = runner.run('noise-texture-2d', firstCase);
    await settle();
    workers[0]?.respond();

    expect(sha256((await result).pixels)).toBe(PINNED_PIXEL_HASHES[firstCase.name]);
  });

  it('starts no worker before the first job', () => {
    const { workers } = runnerWithFakes();
    expect(workers).toHaveLength(0);
  });

  it('serves jobs in order through one worker', async () => {
    const { runner, workers } = runnerWithFakes();
    const first = runner.run('noise-texture-2d', firstCase);
    const second = runner.run('noise-texture-2d', secondCase);
    await settle();
    expect(workers[0]?.held).toHaveLength(1);
    workers[0]?.respond();
    await first;
    await settle();
    workers[0]?.respond();

    expect(sha256((await second).pixels)).toBe(PINNED_PIXEL_HASHES[secondCase.name]);
    expect(workers).toHaveLength(1);
  });

  it("rejects with the job's own error class", async () => {
    const { runner, workers } = runnerWithFakes();
    const run = vi.spyOn(WORKER_JOBS['noise-texture-2d'], 'run').mockImplementation(() => {
      throw new RangeError('Array buffer allocation failed');
    });
    const result = runner.run('noise-texture-2d', firstCase);
    await settle();
    workers[0]?.respond();
    run.mockRestore();

    await expect(result).rejects.toBeInstanceOf(RangeError);
  });
});

describe('WorkerJobRunner cancellation', () => {
  it('rejects an already-aborted job without posting it', async () => {
    const { runner, workers } = runnerWithFakes();
    const result = runner.run('noise-texture-2d', firstCase, AbortSignal.abort());

    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(workers).toHaveLength(0);
  });

  it('drops a queued job that is aborted before its turn', async () => {
    const { runner, workers } = runnerWithFakes();
    const controller = new AbortController();
    const first = runner.run('noise-texture-2d', firstCase);
    const second = runner.run('noise-texture-2d', secondCase, controller.signal);
    const secondAborted = expect(second).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await settle();
    workers[0]?.respond();
    await first;
    await settle();

    await secondAborted;
    expect(workers[0]?.held).toHaveLength(0);
  });

  it('terminates the worker of a running job, and starts a new one for the next job', async () => {
    const { runner, workers } = runnerWithFakes();
    const controller = new AbortController();
    const first = runner.run('noise-texture-2d', firstCase, controller.signal);
    const second = runner.run('noise-texture-2d', secondCase);
    await settle();
    controller.abort();

    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    expect(workers[0]?.terminated).toBe(true);
    await settle();
    workers[1]?.respond();
    expect(sha256((await second).pixels)).toBe(PINNED_PIXEL_HASHES[secondCase.name]);
  });

  it('terminates a worker that finishes starting after its job was aborted, and does not fall back', async () => {
    const started: FakeWorker[] = [];
    let finishStarting: (() => void) | undefined;
    const runner = new WorkerJobRunner({
      createWorker: () =>
        new Promise<FakeWorker>((resolve) => {
          finishStarting = () => {
            const worker = new FakeWorker();
            started.push(worker);
            resolve(worker);
          };
        }),
    });
    const controller = new AbortController();
    const result = runner.run('noise-texture-2d', firstCase, controller.signal);
    await settle();
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    finishStarting?.();
    await settle();

    expect(started[0]?.terminated).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('ignores an abort after the job has finished', async () => {
    const { runner, workers } = runnerWithFakes();
    const controller = new AbortController();
    const result = runner.run('noise-texture-2d', firstCase, controller.signal);
    await settle();
    workers[0]?.respond();
    await result;
    controller.abort();

    expect(workers[0]?.terminated).toBe(false);
  });

  it('terminates its worker on dispose', async () => {
    const { runner, workers } = runnerWithFakes();
    const result = runner.run('noise-texture-2d', firstCase);
    await settle();
    runner.dispose();

    expect(workers[0]?.terminated).toBe(true);
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('WorkerJobRunner in-thread fallback', () => {
  it('runs in-thread when the host gives no worker, with no warning', async () => {
    const runner = new WorkerJobRunner();
    const { pixels } = await runner.run('noise-texture-2d', firstCase);

    expect(sha256(pixels)).toBe(PINNED_PIXEL_HASHES[firstCase.name]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('runs in a later task, so an abort before it starts skips the job', async () => {
    const runner = new WorkerJobRunner();
    const run = vi.spyOn(WORKER_JOBS['noise-texture-2d'], 'run');
    const controller = new AbortController();
    const result = runner.run('noise-texture-2d', firstCase, controller.signal);
    controller.abort();

    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(run).not.toHaveBeenCalled();
    run.mockRestore();
  });

  it.each([
    [
      'throws',
      () => {
        throw new Error('blocked by CSP');
      },
    ],
    ['rejects', () => Promise.reject(new Error('blocked by CSP'))],
  ])('falls back once, with one warning, when the factory %s', async (_label, createWorker) => {
    const runner = new WorkerJobRunner({ createWorker });
    const first = await runner.run('noise-texture-2d', firstCase);
    const second = await runner.run('noise-texture-2d', secondCase);

    expect(sha256(first.pixels)).toBe(PINNED_PIXEL_HASHES[firstCase.name]);
    expect(sha256(second.pixels)).toBe(PINNED_PIXEL_HASHES[secondCase.name]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('falls back when the worker raises an error event, and re-runs the job in-thread', async () => {
    const { runner, workers } = runnerWithFakes();
    const result = runner.run('noise-texture-2d', firstCase);
    await settle();
    workers[0]?.fail('worker script refused');

    expect(sha256((await result).pixels)).toBe(PINNED_PIXEL_HASHES[firstCase.name]);
    expect(workers[0]?.terminated).toBe(true);
    await runner.run('noise-texture-2d', secondCase);
    expect(workers).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
