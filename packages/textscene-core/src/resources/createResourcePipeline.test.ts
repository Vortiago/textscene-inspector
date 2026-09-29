/** createResourcePipeline wires a host ResourceProvider in: FileEventBus, then ResourceLoader, then setProvider. */
import { describe, it, expect, vi } from 'vitest';
import { NOISE_PIXEL_CASES } from './textures/noisetexture2d/pixelCases.testkit';
import { FakeWorker } from '../workers/fakeWorker.testkit';
import { createResourcePipeline } from './createResourcePipeline';
import { ResourceLoader } from './ResourceLoader';
import type { ResourceProvider } from './ResourceProvider';

const fakeProvider: ResourceProvider = {
  loadResource: async () => null,
};

describe('createResourcePipeline', () => {
  it('returns a ResourceLoader wired to the given provider', () => {
    const { provider, loader } = createResourcePipeline(fakeProvider);

    expect(provider).toBe(fakeProvider);
    expect(loader).toBeInstanceOf(ResourceLoader);
    expect(loader.getProvider()).toBe(fakeProvider);
  });

  it('builds a loader with its processor accessors ready', () => {
    const { loader } = createResourcePipeline(fakeProvider);

    expect(loader.textures).toBeDefined();
    expect(loader.scenes).toBeDefined();
  });

  it('gives the loader a job runner that starts the host worker on its first job, not before', async () => {
    const [pixelCase] = NOISE_PIXEL_CASES;
    if (!pixelCase) throw new Error('expected a noise pixel case');
    const worker = new FakeWorker();
    const createWorker = vi.fn(() => worker);
    const { loader } = createResourcePipeline(fakeProvider, { createWorker });
    expect(createWorker).not.toHaveBeenCalled();

    const job = loader.jobRunner.run('noise-texture-2d', pixelCase);
    await new Promise((resolve) => setTimeout(resolve, 0));
    worker.respond();
    await job;
    expect(createWorker).toHaveBeenCalledTimes(1);
  });

  it('runs jobs in-thread when the host gives no worker', async () => {
    const [pixelCase] = NOISE_PIXEL_CASES;
    if (!pixelCase) throw new Error('expected a noise pixel case');
    const { loader } = createResourcePipeline(fakeProvider);

    const { pixels } = await loader.jobRunner.run('noise-texture-2d', pixelCase);
    expect(pixels.length).toBe(pixelCase.tex.width * pixelCase.tex.height * 4);
  });
});
