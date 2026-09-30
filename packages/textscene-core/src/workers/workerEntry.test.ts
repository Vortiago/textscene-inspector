/**
 * The worker side of the protocol: a request names a job, and the reply carries
 * its output, or its error by name and message, under the request's id.
 */
import { describe, expect, it, vi } from 'vitest';
import { NOISE_PIXEL_CASES } from '../resources/textures/noisetexture2d/pixelCases.testkit';
import { WORKER_JOBS } from './jobs';
import { installWorkerJobs, type WorkerJobScope } from './workerEntry';

const [firstCase] = NOISE_PIXEL_CASES;
if (!firstCase) throw new Error('expected at least one noise pixel case');

interface Posted {
  message: unknown;
  transfer: readonly Transferable[];
}

/** A scope that records replies and lets a test deliver one request. */
function fakeScope() {
  let listener: ((event: { data: unknown }) => void) | undefined;
  const posted: Posted[] = [];
  const scope: WorkerJobScope = {
    addEventListener: (_type, handler) => {
      listener = handler;
    },
    postMessage: (message, transfer) => {
      posted.push({ message, transfer });
    },
  };
  installWorkerJobs(scope);
  const deliver = (data: unknown) => {
    if (!listener) throw new Error('expected installWorkerJobs to listen for messages');
    listener({ data });
  };
  return { deliver, posted };
}

describe('installWorkerJobs', () => {
  it('answers a job with its output and transfers the pixel buffer', () => {
    const { deliver, posted } = fakeScope();
    deliver({ id: 3, job: 'noise-texture-2d', input: firstCase });

    expect(posted).toHaveLength(1);
    const [reply] = posted;
    const output = WORKER_JOBS['noise-texture-2d'].run(firstCase);
    expect(reply?.message).toEqual({ id: 3, ok: true, output });
    const sent = reply?.message as { output: { pixels: Uint8Array } };
    expect(reply?.transfer).toEqual([sent.output.pixels.buffer]);
  });

  it('answers an unknown job with an error under the same id', () => {
    const { deliver, posted } = fakeScope();
    deliver({ id: 4, job: 'no-such-job', input: {} });

    expect(posted).toEqual([
      {
        message: {
          id: 4,
          ok: false,
          error: { name: 'Error', message: 'unknown worker job "no-such-job"' },
        },
        transfer: [],
      },
    ]);
  });

  it('keeps a RangeError by name, so the caller still treats it as an allocation failure', () => {
    const { deliver, posted } = fakeScope();
    const run = vi.spyOn(WORKER_JOBS['noise-texture-2d'], 'run').mockImplementation(() => {
      throw new RangeError('Array buffer allocation failed');
    });
    try {
      deliver({ id: 5, job: 'noise-texture-2d', input: firstCase });
    } finally {
      run.mockRestore();
    }

    expect(posted[0]?.message).toEqual({
      id: 5,
      ok: false,
      error: { name: 'RangeError', message: 'Array buffer allocation failed' },
    });
  });

  it.each([
    ['no id', { job: 'noise-texture-2d', input: firstCase }],
    ['no job name', { id: 6, input: firstCase }],
    ['not an object', 'noise-texture-2d'],
    ['null', null],
  ])('ignores a message with %s', (_label, data) => {
    const { deliver, posted } = fakeScope();
    deliver(data);
    expect(posted).toEqual([]);
  });
});
