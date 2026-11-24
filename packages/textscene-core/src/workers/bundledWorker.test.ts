// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startBundledWorker } from './bundledWorker';

vi.mock('virtual:texture-worker-source', () => ({ default: 'postMessage(1);' }));

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

describe('startBundledWorker', () => {
  it('starts the worker from a blob URL of the bundled script', async () => {
    vi.stubGlobal('Worker', StubWorker);
    const worker = (await startBundledWorker()) as unknown as StubWorker;

    expect(worker.url.startsWith('blob:')).toBe(true);
    const text = await (await fetch(worker.url)).text();
    expect(text).toBe('postMessage(1);');
  });

  it('reuses one blob URL for a restarted worker', async () => {
    vi.stubGlobal('Worker', StubWorker);

    await startBundledWorker();
    await startBundledWorker();
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
    await expect(startBundledWorker()).rejects.toThrow('blocked by worker-src');
  });
});
