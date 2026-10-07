/**
 * The loader-level surface: `register()` idempotence, failed loads caching null,
 * corpus switches and the unknown-type guard. `provideFile` has its own table in
 * `provideFile.integration.test.tsx`, and hooks and processors have their own tests.
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

  describe('scene addresses no [ext_resource] declares', () => {
    it('loads a raw `res://` scene path nothing ever registered', async () => {
      // A node's `instance` may name the path directly. No ExtResource declares it,
      // so nothing calls `register`, and both walks that request it must still load it.
      const rawPath = 'res://scenes/never-registered.tscn';
      provider.files.set(rawPath, VALID_TSCN);
      const loaded = loader.eventBus.once<TscnScene>('scene', 'loaded', rawPath);

      loader.request('scene', rawPath);

      const scene = await loaded;
      expect(scene.nodes[0]!.name).toBe('Root');
      // Nothing declared a type for it either, but the channel it was asked
      // through is still what the provider is asked to fetch.
      expect(provider.loadResource).toHaveBeenCalledWith(rawPath, 'PackedScene');
    });

    it('still refuses an id that is not a path', async () => {
      const pending = loader.eventBus.once<TscnScene>('scene', 'loaded', '9_unknown');

      loader.request('scene', '9_unknown');

      await expect(pending).rejects.toThrow('Scene metadata not found');
      expect(loader.scenes.getCached('9_unknown')).toBeNull();
    });
  });

  describe('failed loads', () => {
    it('caches null when the provider has no content for the path', async () => {
      loader.register(SCENE_META);
      const pending = loader.eventBus.once<TscnScene>('scene', 'loaded', SCENE_PATH);

      loader.request('scene', SCENE_PATH);

      // Provider returns null -> scene processor rejects -> once() rejects.
      await expect(pending).rejects.toThrow(`Resource not found: ${SCENE_PATH}`);
      expect(loader.getCached('scene', SCENE_PATH)).toBeNull();
      expect(loader.scenes.getCached(SCENE_PATH)).toBeNull();
      expect(loader.scenes.isCached(SCENE_PATH)).toBe(true);
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

      // A caller subscriber registered before the clear still receives events,
      // unlike `clear()`, which re-registers only the loader's own callbacks.
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

  describe('clear()', () => {
    it('drops caches and metadata', () => {
      loader.register(SCENE_META);
      provider.files.set(SCENE_PATH, VALID_TSCN);
      loader.clear();
      expect(loader.metadata.getAll()).toHaveLength(0);
      expect(loader.scenes.isCached(SCENE_PATH)).toBe(false);
    });
  });
  // The signal CameraFit uses to know loading has finished. A timer can only guess,
  // and frames whatever has decoded when large external .tres meshes are still loading.
  describe('pending-resource activity', () => {
    it('starts settled', () => {
      expect(loader.pendingResourceCount).toBe(0);
    });

    it('counts concurrent waiters and only reaches zero when the last releases', () => {
      const releaseA = loader.beginPending();
      const releaseB = loader.beginPending();
      expect(loader.pendingResourceCount).toBe(2);
      releaseA();
      expect(loader.pendingResourceCount).toBe(1);
      releaseB();
      expect(loader.pendingResourceCount).toBe(0);
    });

    it('ignores a double release, so one consumer cannot drive the count negative', () => {
      const release = loader.beginPending();
      release();
      release();
      expect(loader.pendingResourceCount).toBe(0);
    });

    it('notifies subscribers on begin and on release', () => {
      const seen: number[] = [];
      const unsubscribe = loader.subscribePending(() => seen.push(loader.pendingResourceCount));
      const release = loader.beginPending();
      release();
      unsubscribe();
      expect(seen).toEqual([1, 0]);
    });

    it('stops notifying after unsubscribe', () => {
      let calls = 0;
      const unsubscribe = loader.subscribePending(() => {
        calls += 1;
      });
      unsubscribe();
      loader.beginPending()();
      expect(calls).toBe(0);
    });
  });
});
