/**
 * `createResourceProcessor` against a **Sub-resource path** (`file::id`): it caches,
 * dedupes and announces under the whole address, while only the owning file reaches
 * the `FileEventBus` and the provider. Pinned at the factory, since every consumer
 * keeps its path-keyed contract through it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createResourceProcessor, type ResourceProcessor } from './createResourceProcessor';
import { ResourceEventBus } from './ResourceEventBus';
import { FileEventBus, type FileData } from './FileEventBus';
import type { ResourceProvider } from './ResourceProvider';

class MockProvider implements ResourceProvider {
  files = new Map<string, string | ArrayBuffer>();
  loadResource = vi.fn(async (path: string): Promise<string | ArrayBuffer | null> => {
    return this.files.get(path) ?? null;
  });
}

const flush = (ms = 20) => new Promise((r) => setTimeout(r, ms));

describe('createResourceProcessor with a sub-resource path', () => {
  let eventBus: ResourceEventBus;
  let provider: MockProvider;
  let fileEventBus: FileEventBus;
  let shouldProcessSpy: ReturnType<typeof vi.fn>;
  let processor: ResourceProcessor<string>;

  beforeEach(() => {
    eventBus = new ResourceEventBus();
    provider = new MockProvider();
    provider.files.set('res://wheel.tres', 'wheel-bytes');
    fileEventBus = new FileEventBus(provider);
    shouldProcessSpy = vi.fn((_path: string, data: FileData) => typeof data === 'string');
    processor = createResourceProcessor<string>({
      fileEventBus,
      eventBus,
      resourceType: 'resource',
      shouldProcess: shouldProcessSpy as (path: string, data: FileData) => boolean,
      // This `process` reads its path, so it is allowed to be asked for one.
      addressesSubResources: true,
      process: async (path, data) => `${String(data)}@${path}`,
    });
  });

  it('fetches the owning file but caches and announces under the whole address', async () => {
    const loaded = vi.fn();
    eventBus.on<string>('resource', 'loaded', loaded);

    processor.request('res://wheel.tres::StandardMaterial3D_shvqh');
    await flush();

    expect(provider.loadResource).toHaveBeenCalledWith('res://wheel.tres');
    expect(loaded).toHaveBeenCalledWith(
      'res://wheel.tres::StandardMaterial3D_shvqh',
      'wheel-bytes@res://wheel.tres::StandardMaterial3D_shvqh'
    );
    expect(processor.getCached('res://wheel.tres::StandardMaterial3D_shvqh')).toBe(
      'wheel-bytes@res://wheel.tres::StandardMaterial3D_shvqh'
    );
    // The file itself was never requested as a resource, only as bytes.
    expect(processor.getCached('res://wheel.tres')).toBeUndefined();
  });

  it('asks shouldProcess about the owning file, so extension checks keep working', async () => {
    processor.request('res://wheel.tres::StandardMaterial3D_shvqh');
    await flush();

    expect(shouldProcessSpy).toHaveBeenCalledWith('res://wheel.tres', 'wheel-bytes');
  });

  it('resolves every sibling sub-resource of one file from a single fetch', async () => {
    const loaded = vi.fn();
    eventBus.on<string>('resource', 'loaded', loaded);

    processor.request('res://wheel.tres::StandardMaterial3D_shvqh');
    processor.request('res://wheel.tres::StandardMaterial3D_020iw');
    await flush();

    expect(provider.loadResource).toHaveBeenCalledTimes(1);
    expect(loaded.mock.calls.map((call) => call[0])).toEqual([
      'res://wheel.tres::StandardMaterial3D_shvqh',
      'res://wheel.tres::StandardMaterial3D_020iw',
    ]);
  });

  it('fails a sub-resource of a file that cannot be loaded', async () => {
    const failed = vi.fn();
    eventBus.on<Error>('resource', 'failed', failed);

    processor.request('res://absent.tres::StandardMaterial3D_x');
    await flush();

    expect(failed).toHaveBeenCalledWith(
      'res://absent.tres::StandardMaterial3D_x',
      expect.objectContaining({ message: expect.stringContaining('res://absent.tres') })
    );
    expect(processor.getCached('res://absent.tres::StandardMaterial3D_x')).toBeNull();
  });

  it('clearing the owning file drops its sub-resources and announces them', async () => {
    processor.request('res://wheel.tres::StandardMaterial3D_shvqh');
    await flush();

    const invalidated = vi.fn();
    eventBus.on('resource', 'invalidated', invalidated);
    processor.clearCache('res://wheel.tres');

    expect(processor.getCached('res://wheel.tres::StandardMaterial3D_shvqh')).toBeUndefined();
    // A per-path clear is otherwise silent, since its caller re-requests the path.
    // Nobody re-requests a sub-resource, so without the announcement a mounted
    // consumer serves the stale value after a **Dependency hot-reload**.
    expect(invalidated).toHaveBeenCalledWith(
      'res://wheel.tres::StandardMaterial3D_shvqh',
      undefined
    );
  });

  it('reports a cached sub-resource under its whole address', async () => {
    processor.request('res://wheel.tres::StandardMaterial3D_shvqh');
    await flush();

    expect(processor.cachedPaths()).toEqual(['res://wheel.tres::StandardMaterial3D_shvqh']);
  });

  it('refuses an address when the processor has not opted in', async () => {
    // A `process` that ignores its path would cache the whole file's resource under
    // the address: a wrong resource under a right-looking name. The default fails
    // instead, so a processor that does not know about addresses is safe.
    const failed = vi.fn();
    eventBus.on<Error>('resource', 'failed', failed);
    const unaware = createResourceProcessor<string>({
      fileEventBus,
      eventBus,
      resourceType: 'resource',
      shouldProcess: () => true,
      process: async (_path, data) => String(data),
    });

    unaware.request('res://wheel.tres::StandardMaterial3D_shvqh');
    await flush();

    expect(failed).toHaveBeenCalledWith(
      'res://wheel.tres::StandardMaterial3D_shvqh',
      expect.objectContaining({
        message: expect.stringContaining('cannot address the sub-resource'),
      })
    );
    expect(unaware.getCached('res://wheel.tres::StandardMaterial3D_shvqh')).toBeNull();
  });
});
