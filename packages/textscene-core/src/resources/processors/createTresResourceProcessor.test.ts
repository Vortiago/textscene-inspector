/**
 * Generic .tres processor: fetches a Godot resource file through the
 * FileEventBus and parses it into a ParsedResource on the 'resource' bus slot.
 */
import { describe, it, expect, vi } from 'vitest';
import { ResourceEventBus } from '../ResourceEventBus';
import type { FileEventBus, FileData } from '../FileEventBus';
import type { ParsedResource } from '../../parser/parsedResource';
import { createTresResourceProcessor } from './createTresResourceProcessor';
import { ragdollBytes } from '../formats/binaryresource/testing/ragdollBake';

const TILESET_TRES = `[gd_resource type="TileSet" format=3]

[resource]
tile_size = Vector2i(128, 64)
`;

function mockFileBus() {
  const handlers = {
    loaded: new Set<(p: string, d: FileData) => void>(),
    failed: new Set<(p: string, e: Error) => void>(),
  };
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

  it('reads a requested .gdshader file as a Shader with its code', async () => {
    const file = mockFileBus();
    const eventBus = new ResourceEventBus();
    const processor = createTresResourceProcessor(file.bus, eventBus);

    const loaded = eventBus.once<ParsedResource>('resource', 'loaded', 'res://fog.gdshader', 1000);
    processor.request('res://fog.gdshader');
    file.emitLoaded('res://fog.gdshader', 'shader_type fog;\n');

    expect(await loaded).toMatchObject({
      resourceType: 'Shader',
      properties: { code: '"shader_type fog;\n"' },
    });
  });

  it('reads a binary resource into the same ParsedResource shape', async () => {
    const file = mockFileBus();
    const eventBus = new ResourceEventBus();
    const processor = createTresResourceProcessor(file.bus, eventBus);

    const loaded = eventBus.once<ParsedResource>('resource', 'loaded', 'res://ragdoll_physics.lmbake', 1000);
    processor.request('res://ragdoll_physics.lmbake');
    file.emitLoaded('res://ragdoll_physics.lmbake', ragdollBytes('ragdoll_physics.lmbake'));

    expect((await loaded).resourceType).toBe('LightmapGIData');
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

  it('emits resource:failed for text that is not a .tres, such as a .tscn', async () => {
    const file = mockFileBus();
    const eventBus = new ResourceEventBus();
    const processor = createTresResourceProcessor(file.bus, eventBus);

    const failed = eventBus.once<Error>('resource', 'failed', 'res://scene.tscn', 1000);
    processor.request('res://scene.tscn');
    file.emitLoaded('res://scene.tscn', '[gd_scene format=3]\n\n[node name="Root" type="Node"]\n');

    expect((await failed).message).toContain('missing [gd_resource] header type');
    expect(processor.isLoading('res://scene.tscn')).toBe(false);
  });

  it('emits resource:failed for bytes that are no binary resource', async () => {
    const file = mockFileBus();
    const eventBus = new ResourceEventBus();
    const processor = createTresResourceProcessor(file.bus, eventBus);

    const failed = eventBus.once<Error>('resource', 'failed', 'res://theme.res', 1000);
    processor.request('res://theme.res');
    file.emitLoaded('res://theme.res', new ArrayBuffer(4));

    expect((await failed).message).toBe(
      'expected a binary resource starting with RSRC, got "\\u0000\\u0000\\u0000\\u0000"'
    );
    expect(processor.getCached('res://theme.res')).toBeNull();
  });
});
