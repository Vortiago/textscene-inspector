/**
 * The web previewer's resource pipeline: the provider, and the job worker its
 * loader builds procedural textures in.
 */
import { describe, expect, it, vi } from 'vitest';
import { createWebPipeline } from './webPipeline';
import { WebResourceProvider } from './providers/WebResourceProvider';

describe('createWebPipeline', () => {
  it('wires a WebResourceProvider into the loader', () => {
    const { provider, loader } = createWebPipeline({ hasFixturesMirror: false });
    expect(provider).toBeInstanceOf(WebResourceProvider);
    expect(loader.getProvider()).toBe(provider);
  });

  it('gives the loader the host worker factory, which runs on the first job', async () => {
    const createWorker = vi.fn(() => {
      throw new Error('no worker in this test');
    });
    const { loader } = createWebPipeline({ hasFixturesMirror: false, createWorker });
    expect(createWorker).not.toHaveBeenCalled();

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // The job's result is not the point: only that the loader asked the host for a worker.
    await loader.jobRunner.run('noise-texture-2d', {} as never).catch(() => undefined);
    warn.mockRestore();
    expect(createWorker).toHaveBeenCalledTimes(1);
  });
});
