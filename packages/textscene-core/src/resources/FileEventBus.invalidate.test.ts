/**
 * `invalidate` is a file changing under the bus: the bytes go and its readers are
 * told. `clearCache` only frees memory after a load, so it tells nobody.
 */
import { describe, expect, it, vi } from 'vitest';
import { FileEventBus } from './FileEventBus';
import { busServing } from './testing/servingFileBus';

function gatedBus() {
  const releases: Array<(value: string) => void> = [];
  const loadResource = vi.fn(() => new Promise<string>((resolve) => releases.push(resolve)));
  return { bus: new FileEventBus({ loadResource }), loadResource, releases };
}

describe('FileEventBus.invalidate', () => {
  it('drops the bytes, so the next read fetches the file again', async () => {
    const { bus, loads, files } = busServing({ 'res://project.godot': 'old' });
    await bus.tryLoad('res://project.godot');

    files['res://project.godot'] = 'new';
    bus.invalidate('res://project.godot');

    await expect(bus.tryLoad('res://project.godot')).resolves.toBe('new');
    expect(loads).toHaveLength(2);
  });

  it('tells its invalidated handlers which path changed', () => {
    const { bus } = busServing({});
    const invalidated = vi.fn();
    bus.on('invalidated', invalidated);

    bus.invalidate('res://project.godot');

    expect(invalidated).toHaveBeenCalledWith('res://project.godot');
  });

  it('stops telling a handler once it is removed', () => {
    const { bus } = busServing({});
    const invalidated = vi.fn();
    bus.on('invalidated', invalidated);
    bus.off('invalidated', invalidated);

    bus.invalidate('res://project.godot');

    expect(invalidated).not.toHaveBeenCalled();
  });

  it('runs every handler even when one throws', () => {
    const { bus } = busServing({});
    const second = vi.fn();
    bus.on('invalidated', () => {
      throw new Error('boom');
    });
    bus.on('invalidated', second);

    bus.invalidate('res://project.godot');

    expect(second).toHaveBeenCalledWith('res://project.godot');
  });
});

describe('FileEventBus.clearCache', () => {
  it('frees the bytes without telling the invalidated handlers', async () => {
    const { bus } = busServing({ 'res://a.png': 'x' });
    const invalidated = vi.fn();
    bus.on('invalidated', invalidated);
    await bus.tryLoad('res://a.png');

    bus.clearCache('res://a.png');
    bus.clearCache();

    expect(invalidated).not.toHaveBeenCalled();
  });
});

describe('FileEventBus.tryLoad racing a change', () => {
  it('does not cache bytes read before an invalidate', async () => {
    const { bus, loadResource, releases } = gatedBus();
    const stale = bus.tryLoad('res://project.godot');

    bus.invalidate('res://project.godot');
    releases[0]!('old');
    await stale;

    const fresh = bus.tryLoad('res://project.godot');
    releases[1]!('new');
    await expect(fresh).resolves.toBe('new');
    expect(loadResource).toHaveBeenCalledTimes(2);
  });

  it('does not absorb a concurrent request, which still announces its load', async () => {
    const { bus, releases } = gatedBus();
    const loaded = vi.fn();
    bus.on('loaded', loaded);

    void bus.tryLoad('res://a.glb.import');
    bus.request('res://a.glb.import');
    releases.forEach((release) => release('x'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(loaded).toHaveBeenCalledWith('res://a.glb.import', 'x');
  });
});
