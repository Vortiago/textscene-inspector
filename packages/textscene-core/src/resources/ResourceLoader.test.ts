/**
 * Tests for ResourceLoader covering ONLY the gaps not exercised elsewhere:
 *
 *   - useResource*.test.tsx covers hook-level status transitions and the
 *     late-arrival flow at the React layer.
 *   - processors/createSceneProcessor.test.ts covers processor-level cache,
 *     dedupe, and failure semantics.
 *
 * Here we pin the loader-level surface: register() idempotence, the
 * provideFile() late-arrival flow (file cache + processor cache cleared,
 * then re-requested through the right processor), the metadata-less
 * fan-out, failed loads caching null, and the unknown-type guard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResourceLoader } from './ResourceLoader';
import { FileEventBus } from './FileEventBus';
import type { ResourceProvider } from './ResourceProvider';
import type { TscnScene, ExtResource } from '../parser/types';

const SCENE_PATH = 'res://scenes/sub.tscn';
const SCENE_META: ExtResource = { id: '1_sub', path: SCENE_PATH, type: 'PackedScene' };
const VALID_TSCN = `[gd_scene format=3]

[node name="Root" type="Node3D"]
`;

class MockProvider implements ResourceProvider {
  files = new Map<string, string | ArrayBuffer>();
  loadResource = vi.fn(async (path: string): Promise<string | ArrayBuffer | null> => {
    return this.files.get(path) ?? null;
  });
}

describe('ResourceLoader (loader-level gaps)', () => {
  let provider: MockProvider;
  let fileEventBus: FileEventBus;
  let loader: ResourceLoader;

  beforeEach(() => {
    provider = new MockProvider();
    fileEventBus = new FileEventBus(provider);
    loader = new ResourceLoader(fileEventBus);
    loader.setProvider(provider);
  });

  describe('register()', () => {
    it('is idempotent: registering the same resource twice keeps one metadata entry', () => {
      loader.register(SCENE_META);
      loader.register(SCENE_META);

      expect(loader.metadata.getAll()).toHaveLength(1);
      expect(loader.resolvePath('1_sub')).toBe(SCENE_PATH);
      expect(loader.resolvePath(SCENE_PATH)).toBe(SCENE_PATH);
      expect(loader.hasResource('1_sub')).toBe(true);
      expect(loader.getMetadata('1_sub')).toBe(SCENE_META);
    });

    it('resolvePath falls through to the input for unregistered ids', () => {
      expect(loader.resolvePath('res://unregistered.png')).toBe('res://unregistered.png');
    });
  });

  describe('failed loads', () => {
    it('caches null when the provider has no content for the path', async () => {
      loader.register(SCENE_META);
      const pending = loader.eventBus.once<TscnScene>('scene', 'loaded', SCENE_PATH);

      loader.request('scene', SCENE_PATH);

      // Provider returns null -> scene processor rejects -> once() rejects.
      await expect(pending).rejects.toThrow('TSCN scene must be text content');
      expect(loader.getCached('scene', SCENE_PATH)).toBeNull();
      expect(loader.scenes.getCached(SCENE_PATH)).toBeNull();
      expect(loader.scenes.isCached(SCENE_PATH)).toBe(true);
    });
  });

  describe('provideFile() — the late-arrival flow at the loader level', () => {
    it('clears file + processor caches and re-requests through the typed processor', async () => {
      loader.register(SCENE_META);

      // Phase 1: the file is missing; the failure is cached as null.
      const firstAttempt = loader.eventBus.once<TscnScene>('scene', 'loaded', SCENE_PATH);
      loader.request('scene', SCENE_PATH);
      await expect(firstAttempt).rejects.toThrow('must be text content');
      expect(loader.getCached('scene', SCENE_PATH)).toBeNull();
      expect(provider.loadResource).toHaveBeenCalledTimes(1);

      // Phase 2: the host now has the file; provideFile must drop the stale
      // failure (file cache AND processor cache) and re-request fresh.
      provider.files.set(SCENE_PATH, VALID_TSCN);
      const fileCacheSpy = vi.spyOn(fileEventBus, 'clearCache');
      const reloaded = loader.eventBus.once<TscnScene>('scene', 'loaded', SCENE_PATH);

      loader.provideFile(SCENE_PATH);

      expect(fileCacheSpy).toHaveBeenCalledWith(SCENE_PATH);
      const scene = await reloaded;
      expect(scene.nodes).toHaveLength(1);
      expect(scene.nodes[0]!.name).toBe('Root');
      expect(provider.loadResource).toHaveBeenCalledTimes(2);
      expect(loader.getCached<TscnScene>('scene', SCENE_PATH)).toBe(scene);
    });

    it('fans out to texture + material processors when the path has no registered metadata', () => {
      const texSpy = vi.spyOn(loader.textures, 'request');
      const matSpy = vi.spyOn(loader.materials, 'request');
      const sceneSpy = vi.spyOn(loader.scenes, 'request');
      const glbSpy = vi.spyOn(loader.glbMeshes, 'request');

      loader.provideFile('res://mystery.png');

      expect(texSpy).toHaveBeenCalledWith('res://mystery.png');
      expect(matSpy).toHaveBeenCalledWith('res://mystery.png');
      expect(sceneSpy).not.toHaveBeenCalled();
      expect(glbSpy).not.toHaveBeenCalled();
    });

    it('fans an unregistered .tres out to both .tres processors (material + generic resource)', () => {
      // A raw `res://…tres` reference (e.g. a tile_set path never declared as
      // ExtResource) must reach the generic resource processor too, or a
      // late-arrival upload can never resolve the TileSet.
      const matSpy = vi.spyOn(loader.materials, 'request');
      const resSpy = vi.spyOn(loader.resources, 'request');
      const texSpy = vi.spyOn(loader.textures, 'request');

      loader.provideFile('res://tileset/tiles.tres');

      expect(matSpy).toHaveBeenCalledWith('res://tileset/tiles.tres');
      expect(resSpy).toHaveBeenCalledWith('res://tileset/tiles.tres');
      expect(texSpy).not.toHaveBeenCalled();
    });

    it('routes a registered TileSet .tres through the generic resource processor', () => {
      loader.register({ id: '1_ts', path: 'res://tiles.tres', type: 'TileSet' });
      const resSpy = vi.spyOn(loader.resources, 'request');

      loader.provideFile('res://tiles.tres');

      expect(resSpy).toHaveBeenCalledWith('res://tiles.tres');
    });
  });

  describe('clearCaches() — corpus switches', () => {
    it('drops all caches and metadata but keeps event subscribers alive', async () => {
      loader.register(SCENE_META);
      provider.files.set(SCENE_PATH, VALID_TSCN);
      const first = loader.eventBus.once<TscnScene>('scene', 'loaded', SCENE_PATH);
      loader.request('scene', SCENE_PATH);
      await first;
      expect(loader.scenes.isCached(SCENE_PATH)).toBe(true);

      const handler = vi.fn();
      loader.eventBus.on('scene', 'loaded', handler);

      loader.clearCaches();
      expect(loader.scenes.isCached(SCENE_PATH)).toBe(false);
      expect(loader.metadata.getAll()).toHaveLength(0);

      // A subscriber registered before the clear still receives events
      // (unlike clear(), which wipes the bus and the loader's own callbacks).
      loader.register(SCENE_META);
      const second = loader.eventBus.once<TscnScene>('scene', 'loaded', SCENE_PATH);
      loader.request('scene', SCENE_PATH);
      await second;
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('type-generic surface guards', () => {
    it('request() with the resource type routes to the generic .tres processor', () => {
      const resSpy = vi.spyOn(loader.resources, 'request');
      expect(() => loader.request('resource', 'res://x.tres')).not.toThrow();
      expect(resSpy).toHaveBeenCalledWith('res://x.tres');
    });
  });
});
