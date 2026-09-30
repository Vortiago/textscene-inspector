/**
 * The web previewer's job worker: a worker class Vite inlines as a blob, started
 * the first time the loader runs a job, never at page load.
 */
import { describe, expect, it, vi } from 'vitest';
import { textureWorkerFactory } from './createTextureWorker';

class StubWorker {
  addEventListener(): void {}
  postMessage(): void {}
  terminate(): void {}
}

describe('textureWorkerFactory', () => {
  it('starts a worker from the inlined worker class', async () => {
    const createWorker = textureWorkerFactory(async () => ({ default: StubWorker }));
    expect(await createWorker()).toBeInstanceOf(StubWorker);
  });

  it('loads the worker class only when the first worker starts', async () => {
    const load = vi.fn(async () => ({ default: StubWorker }));
    const createWorker = textureWorkerFactory(load);
    expect(load).not.toHaveBeenCalled();

    await createWorker();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('rejects when the worker class cannot load, so the runner falls back in-thread', async () => {
    const createWorker = textureWorkerFactory(async () => {
      throw new Error('chunk failed');
    });
    await expect(createWorker()).rejects.toThrow('chunk failed');
  });
});
