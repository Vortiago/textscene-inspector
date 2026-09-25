/**
 * `tryLoad` is the optional-file read: it answers the caller and tells nobody else.
 * An absent **Import sidecar** means Godot's import defaults, while `request()`'s
 * miss fires the `failed` handlers and shows a **Missing resource**.
 */
import { describe, expect, it, vi } from 'vitest';
import { FileEventBus } from './FileEventBus';

function busWith(files: Record<string, string>) {
  const loadResource = vi.fn(async (path: string) => files[path] ?? null);
  return { bus: new FileEventBus({ loadResource }), loadResource };
}

describe('FileEventBus.tryLoad', () => {
  it('returns the file when it exists', async () => {
    const { bus } = busWith({ 'res://a.gltf.import': '[params]\n' });
    await expect(bus.tryLoad('res://a.gltf.import')).resolves.toBe('[params]\n');
  });

  it('returns null for a missing file without announcing it', async () => {
    const { bus } = busWith({});
    const failed = vi.fn();
    bus.on('failed', failed);

    await expect(bus.tryLoad('res://absent.import')).resolves.toBeNull();
    expect(failed).not.toHaveBeenCalled();
  });

  it('returns null when the provider throws, again silently', async () => {
    const loadResource = vi.fn(async () => {
      throw new Error('network down');
    });
    const bus = new FileEventBus({ loadResource });
    const failed = vi.fn();
    bus.on('failed', failed);

    await expect(bus.tryLoad('res://boom.import')).resolves.toBeNull();
    expect(failed).not.toHaveBeenCalled();
  });

  it('does not fire the loaded handlers either', async () => {
    // No consumer subscribes to a sidecar, and waking every handler for one risks a
    // re-entrant load.
    const { bus } = busWith({ 'res://a.gltf.import': 'x' });
    const loaded = vi.fn();
    bus.on('loaded', loaded);

    await bus.tryLoad('res://a.gltf.import');
    expect(loaded).not.toHaveBeenCalled();
  });

  it('serves a repeat read from cache', async () => {
    const { bus, loadResource } = busWith({ 'res://a.gltf.import': 'x' });
    await bus.tryLoad('res://a.gltf.import');
    await bus.tryLoad('res://a.gltf.import');
    expect(loadResource).toHaveBeenCalledTimes(1);
  });

  it('re-reads after the cache is cleared, so a corpus switch cannot serve stale bytes', async () => {
    const { bus, loadResource } = busWith({ 'res://a.gltf.import': 'x' });
    await bus.tryLoad('res://a.gltf.import');
    bus.clearCache();
    await bus.tryLoad('res://a.gltf.import');
    expect(loadResource).toHaveBeenCalledTimes(2);
  });

  it('shares the cache with request(), so a sidecar is read once either way', async () => {
    const { bus, loadResource } = busWith({ 'res://a.gltf.import': 'x' });
    await bus.tryLoad('res://a.gltf.import');
    await new Promise<void>((resolve) => {
      bus.on('loaded', () => resolve());
      bus.request('res://a.gltf.import');
    });
    expect(loadResource).toHaveBeenCalledTimes(1);
  });
});
