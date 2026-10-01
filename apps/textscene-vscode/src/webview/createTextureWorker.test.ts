/**
 * The webview's job worker: started from a blob URL of the bundled source, which
 * the CSP's `worker-src blob:` admits, and loaded only when a job first needs it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { textureWorkerFactory } from './createTextureWorker';

class StubWorker {
  static urls: string[] = [];
  constructor(readonly url: string) {
    StubWorker.urls.push(url);
  }
  addEventListener(): void {}
  postMessage(): void {}
  terminate(): void {}
}

afterEach(() => {
  StubWorker.urls = [];
  vi.unstubAllGlobals();
});

describe('textureWorkerFactory', () => {
  it('starts the worker from a blob URL of the bundled source', async () => {
    vi.stubGlobal('Worker', StubWorker);
    const createWorker = textureWorkerFactory(async () => ({ default: 'postMessage(1);' }));
    const worker = (await createWorker()) as unknown as StubWorker;

    expect(worker.url.startsWith('blob:')).toBe(true);
    const text = await (await fetch(worker.url)).text();
    expect(text).toBe('postMessage(1);');
  });

  it('loads the source once, and reuses its blob URL for a restarted worker', async () => {
    vi.stubGlobal('Worker', StubWorker);
    const load = vi.fn(async () => ({ default: 'postMessage(1);' }));
    const createWorker = textureWorkerFactory(load);
    expect(load).not.toHaveBeenCalled();

    await createWorker();
    await createWorker();
    expect(load).toHaveBeenCalledTimes(1);
    expect(new Set(StubWorker.urls).size).toBe(1);
  });

  it('rejects when the worker cannot start, so the runner falls back in-thread', async () => {
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error('blocked by worker-src');
        }
      }
    );
    const createWorker = textureWorkerFactory(async () => ({ default: '' }));
    await expect(createWorker()).rejects.toThrow('blocked by worker-src');
  });
});
