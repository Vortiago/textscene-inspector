/**
 * Generic .tres processor — fetches a Godot resource file through the
 * FileEventBus and parses it into a ParsedResource on the 'resource' bus slot.
 */
import { describe, it, expect, vi } from 'vitest';
import { ResourceEventBus } from '../ResourceEventBus';
import type { FileEventBus, FileData } from '../FileEventBus';
import type { ParsedResource } from '../../parser/parsedResource';
import { createTresResourceProcessor } from './createTresResourceProcessor';

const TILESET_TRES = `[gd_resource type="TileSet" format=3]

[resource]
tile_size = Vector2i(128, 64)
`;

function mockFileBus() {
  const handlers = { loaded: new Set<(p: string, d: FileData) => void>(), failed: new Set<(p: string, e: Error) => void>() };
  const request = vi.fn();
  const bus = {
    on: (event: 'loaded' | 'failed', h: never) => handlers[event].add(h),
    off: (event: 'loaded' | 'failed', h: never) => handlers[event].delete(h),
    request,
    // createResourceProcessor drops the raw-bytes cache entry once
    // processing settles (success or failure), so a stand-in FileEventBus
    // must implement clearCache() too.
    clearCache: vi.fn(),
  } as unknown as FileEventBus;
  return {
    bus,
    request,
    emitLoaded: (path: string, data: FileData) => handlers.loaded.forEach((h) => h(path, data)),
  };
}

describe('createTresResourceProcessor', () => {
  it('parses a requested .tres file and emits resource:loaded with the ParsedResource', async () => {
    const file = mockFileBus();
    const eventBus = new ResourceEventBus();
    const processor = createTresResourceProcessor(file.bus, eventBus);

    const loaded = eventBus.once<ParsedResource>('resource', 'loaded', 'res://t.tres', 1000);
    processor.request('res://t.tres');
    expect(file.request).toHaveBeenCalledWith('res://t.tres');
    file.emitLoaded('res://t.tres', TILESET_TRES);

    const parsed = await loaded;
    expect(parsed.resourceType).toBe('TileSet');
    expect(processor.getCached('res://t.tres')).toBe(parsed); // identity caching
  });

  it('emits resource:failed and caches null for malformed content', async () => {
    const file = mockFileBus();
    const eventBus = new ResourceEventBus();
    const processor = createTresResourceProcessor(file.bus, eventBus);

    const failed = eventBus.once<Error>('resource', 'failed', 'res://bad.tres', 1000);
    processor.request('res://bad.tres');
    file.emitLoaded('res://bad.tres', 'not a tres file');

    await expect(failed).resolves.toBeInstanceOf(Error);
    expect(processor.getCached('res://bad.tres')).toBeNull();
  });

  it('ignores non-.tres paths and binary data', () => {
    const file = mockFileBus();
    const eventBus = new ResourceEventBus();
    const processor = createTresResourceProcessor(file.bus, eventBus);

    processor.request('res://image.png');
    file.emitLoaded('res://image.png', new ArrayBuffer(4));
    expect(processor.getCached('res://image.png')).toBeUndefined();
  });
});
