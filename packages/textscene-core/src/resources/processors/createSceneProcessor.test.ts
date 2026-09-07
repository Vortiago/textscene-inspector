/**
 * Tests for `createSceneProcessor` — the PackedScene-specific factory
 * built on top of `createResourceProcessor`'s direct-load mode.
 *
 * Coverage carries over from the deleted `loaders/SceneLoader.test.ts`:
 * metadata-driven resolution (id ↔ path), event-bus emissions,
 * cache + inflight semantics, type validation, content validation,
 * reload-after-failure, and tear-down during loading. The shape now
 * matches the other three processors (texture/material/glb), so the
 * cache/inflight/event machinery is implicitly co-tested with them
 * via the shared `createResourceProcessor` loop.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSceneProcessor } from './createSceneProcessor';
import { ResourceEventBus } from '../ResourceEventBus';
import type { ResourceProvider } from '../ResourceProvider';
import type { ResourceProcessor } from '../createResourceProcessor';
import type { TscnScene } from '../../parser/types';

const VALID_TSCN_CONTENT = `[gd_scene format=3]

[node name="Root" type="Node3D"]
`;

interface Metadata {
  id: string;
  path: string;
  type: string;
}

describe('createSceneProcessor (WI-ARCH-2 replacement for SceneLoader)', () => {
  let eventBus: ResourceEventBus;
  let mockProvider: ResourceProvider;
  let metadataMap: Map<string, Metadata>;
  let processor: ResourceProcessor<TscnScene>;
  let provider: ResourceProvider | null;

  const registerMetadata = (id: string, m: Metadata) => {
    metadataMap.set(id, m);
    metadataMap.set(m.path, m);
  };

  beforeEach(() => {
    eventBus = new ResourceEventBus();
    metadataMap = new Map();
    mockProvider = {
      loadResource: vi.fn().mockResolvedValue(VALID_TSCN_CONTENT),
    };
    provider = mockProvider;

    processor = createSceneProcessor({
      eventBus,
      // The ResourceLoader's own rule, not a stand-in for it: an unregistered
      // `res://` address is its own path and carries no declared type.
      resolveMetadata: (idOrPath) => {
        const m = metadataMap.get(idOrPath);
        if (m) return { path: m.path, type: m.type };
        return idOrPath.startsWith('res://') ? { path: idOrPath, type: null } : null;
      },
      getProvider: () => provider,
    });
  });

  afterEach(() => {
    eventBus.clear();
    processor.clearCache();
    vi.restoreAllMocks();
  });

  describe('request', () => {
    it('emits requested event when load initiated', () => {
      const handler = vi.fn();
      eventBus.on('scene', 'requested', handler);
      registerMetadata('scene1', { id: 'scene1', path: 'res://scenes/room.tscn', type: 'PackedScene' });

      processor.request('scene1');

      expect(handler).toHaveBeenCalledWith('scene1', undefined);
    });

    it('emits loading event during load', async () => {
      const handler = vi.fn();
      eventBus.on('scene', 'loading', handler);
      registerMetadata('scene1', { id: 'scene1', path: 'res://scenes/room.tscn', type: 'PackedScene' });

      processor.request('scene1');
      await new Promise((r) => setTimeout(r, 10));

      expect(handler).toHaveBeenCalledWith('scene1', undefined);
    });

    it('emits loaded event with parsed scene on success', async () => {
      const handler = vi.fn();
      eventBus.on<TscnScene>('scene', 'loaded', handler);
      registerMetadata('scene1', { id: 'scene1', path: 'res://scenes/room.tscn', type: 'PackedScene' });

      processor.request('scene1');
      await new Promise((r) => setTimeout(r, 50));

      expect(handler).toHaveBeenCalled();
      const [id, scene] = handler.mock.calls[0]!;
      expect(id).toBe('scene1');
      expect(scene.nodes.length).toBe(1);
      expect(scene.nodes[0].name).toBe('Root');
    });

    it('emits loaded event immediately for cached scenes', async () => {
      registerMetadata('scene1', { id: 'scene1', path: 'res://scenes/room.tscn', type: 'PackedScene' });

      processor.request('scene1');
      await new Promise((r) => setTimeout(r, 50));

      const handler = vi.fn();
      eventBus.on<TscnScene>('scene', 'loaded', handler);
      processor.request('scene1');
      expect(handler).toHaveBeenCalled();
    });

    it('deduplicates concurrent requests', async () => {
      registerMetadata('scene1', { id: 'scene1', path: 'res://scenes/room.tscn', type: 'PackedScene' });

      processor.request('scene1');
      processor.request('scene1');
      processor.request('scene1');
      await new Promise((r) => setTimeout(r, 50));

      expect(mockProvider.loadResource).toHaveBeenCalledTimes(1);
    });

    it('emits failed event when metadata not found', async () => {
      const handler = vi.fn();
      eventBus.on<Error>('scene', 'failed', handler);

      processor.request('nonexistent');
      await new Promise((r) => setTimeout(r, 10));

      expect(handler).toHaveBeenCalled();
      const [, error] = handler.mock.calls[0]!;
      expect(error.message).toContain('metadata not found');
    });

    it('emits failed event when provider fails', async () => {
      const handler = vi.fn();
      eventBus.on<Error>('scene', 'failed', handler);
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Network error'));
      registerMetadata('scene1', { id: 'scene1', path: 'res://scenes/room.tscn', type: 'PackedScene' });

      processor.request('scene1');
      await new Promise((r) => setTimeout(r, 20));

      expect(handler).toHaveBeenCalled();
      const [, error] = handler.mock.calls[0]!;
      expect(error.message).toBe('Network error');
    });

    it('emits failed for a BINARY .scn scene instead of silently parsing garbage', async () => {
      // Godot binary resources start with the RSRC magic. The lenient text
      // parser would "succeed" with an empty scene — the level just vanishes
      // with no placeholder and no missing-resources row (3d/platformer's
      // grid_map.scn). It must fail so the standard missing UX kicks in.
      const handler = vi.fn();
      eventBus.on<Error>('scene', 'failed', handler);
      mockProvider.loadResource = vi.fn().mockResolvedValue('RSRC\u0000\u0001binarygarbage');
      registerMetadata('grid', { id: 'grid', path: 'res://stage/grid_map.scn', type: 'PackedScene' });

      processor.request('grid');
      await new Promise((r) => setTimeout(r, 20));

      expect(handler).toHaveBeenCalled();
      const [, error] = handler.mock.calls[0]!;
      expect(error.message).toMatch(/binary/i);
    });

    it('emits failed for text content that is not a TSCN scene', async () => {
      const handler = vi.fn();
      eventBus.on<Error>('scene', 'failed', handler);
      mockProvider.loadResource = vi.fn().mockResolvedValue('<html>404 fallback</html>');
      registerMetadata('s', { id: 's', path: 'res://scenes/x.tscn', type: 'PackedScene' });

      processor.request('s');
      await new Promise((r) => setTimeout(r, 20));

      expect(handler).toHaveBeenCalled();
      const [, error] = handler.mock.calls[0]!;
      expect(error.message).toMatch(/not a text scene/i);
    });

    it('emits failed for previously failed scenes from cache', async () => {
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Initial fail'));
      registerMetadata('scene1', { id: 'scene1', path: 'res://scenes/room.tscn', type: 'PackedScene' });

      processor.request('scene1');
      await new Promise((r) => setTimeout(r, 20));

      const handler = vi.fn();
      eventBus.on<Error>('scene', 'failed', handler);
      processor.request('scene1');

      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0]![0]).toBe('scene1');
    });
  });

  describe('cache management', () => {
    it('isCached returns correct status', async () => {
      registerMetadata('scene1', { id: 'scene1', path: 'res://scenes/room.tscn', type: 'PackedScene' });
      expect(processor.isCached('scene1')).toBe(false);

      processor.request('scene1');
      await eventBus.once<TscnScene>('scene', 'loaded', 'scene1');
      expect(processor.isCached('scene1')).toBe(true);
    });

    it('clearCache removes specific scene', async () => {
      registerMetadata('scene1', { id: 'scene1', path: 'res://scenes/room.tscn', type: 'PackedScene' });

      processor.request('scene1');
      await eventBus.once<TscnScene>('scene', 'loaded', 'scene1');
      expect(processor.isCached('scene1')).toBe(true);

      processor.clearCache('scene1');
      expect(processor.isCached('scene1')).toBe(false);
    });

    it('clearCache() (no arg) removes all scenes', async () => {
      registerMetadata('scene1', { id: 'scene1', path: 'res://scenes/room.tscn', type: 'PackedScene' });
      registerMetadata('scene2', { id: 'scene2', path: 'res://scenes/hallway.tscn', type: 'PackedScene' });

      processor.request('scene1');
      processor.request('scene2');
      await Promise.all([
        eventBus.once<TscnScene>('scene', 'loaded', 'scene1'),
        eventBus.once<TscnScene>('scene', 'loaded', 'scene2'),
      ]);
      expect(processor.getCacheSize()).toBe(2);

      processor.clearCache();
      expect(processor.getCacheSize()).toBe(0);
    });
  });

  describe('isLoading', () => {
    it('returns true while loading', () => {
      registerMetadata('scene1', { id: 'scene1', path: 'res://scenes/room.tscn', type: 'PackedScene' });
      expect(processor.isLoading('scene1')).toBe(false);

      processor.request('scene1');
      expect(processor.isLoading('scene1')).toBe(true);
    });

    it('returns false after loading completes', async () => {
      registerMetadata('scene1', { id: 'scene1', path: 'res://scenes/room.tscn', type: 'PackedScene' });

      processor.request('scene1');
      await new Promise((r) => setTimeout(r, 50));
      expect(processor.isLoading('scene1')).toBe(false);
    });
  });

  describe('provider availability', () => {
    it('emits failed when no provider is set', async () => {
      provider = null;
      const handler = vi.fn();
      eventBus.on<Error>('scene', 'failed', handler);
      registerMetadata('scene1', { id: 'scene1', path: 'res://scenes/room.tscn', type: 'PackedScene' });

      processor.request('scene1');
      await new Promise((r) => setTimeout(r, 20));

      expect(handler).toHaveBeenCalled();
      const [, error] = handler.mock.calls[0]!;
      expect(error.message).toContain('No ResourceProvider');
    });

    it('a later setProvider swap takes effect after clearing the failed cache entry', async () => {
      provider = null;
      const failHandler = vi.fn();
      eventBus.on<Error>('scene', 'failed', failHandler);
      registerMetadata('scene1', { id: 'scene1', path: 'res://scenes/room.tscn', type: 'PackedScene' });

      processor.request('scene1');
      await new Promise((r) => setTimeout(r, 20));
      expect(failHandler).toHaveBeenCalled();

      processor.clearCache('scene1');
      provider = mockProvider;

      const loadedHandler = vi.fn();
      eventBus.on<TscnScene>('scene', 'loaded', loadedHandler);
      processor.request('scene1');
      await new Promise((r) => setTimeout(r, 50));
      expect(loadedHandler).toHaveBeenCalled();
    });
  });

  describe('type validation', () => {
    it('rejects non-PackedScene resource types', async () => {
      const handler = vi.fn();
      eventBus.on<Error>('scene', 'failed', handler);
      registerMetadata('tex1', { id: 'tex1', path: 'res://textures/albedo.png', type: 'Texture2D' });

      processor.request('tex1');
      await new Promise((r) => setTimeout(r, 20));

      const [, error] = handler.mock.calls[0]!;
      expect(error.message).toContain('Not a PackedScene resource');
    });

    it('lets an address with no registered type through to the content checks', async () => {
      // A raw `res://` path no `[ext_resource]` declares has no registered type
      // to disagree with, so the pre-check must abstain rather than guess — but
      // abstaining is not a bypass: the content is still what decides.
      const handler = vi.fn();
      eventBus.on<Error>('scene', 'failed', handler);
      mockProvider.loadResource = vi.fn().mockResolvedValue('[gd_resource type="Theme"]');

      processor.request('res://not-a-scene.tres');
      await new Promise((r) => setTimeout(r, 20));

      expect(handler).toHaveBeenCalled();
      const [, error] = handler.mock.calls[0]!;
      expect(error.message).toContain('missing [gd_scene header');
    });

    it('abstains for a declared resource whose heading carried no type=', async () => {
      // The lenient parser keeps an absent `type=` as `''`, which is the same
      // "nothing declared one" the null case is — not a type that disagrees.
      const loadedHandler = vi.fn();
      eventBus.on<TscnScene>('scene', 'loaded', loadedHandler);
      registerMetadata('1', { id: '1', path: 'res://scenes/typeless.tscn', type: '' });

      processor.request('1');
      await new Promise((r) => setTimeout(r, 20));

      expect(loadedHandler).toHaveBeenCalled();
    });

    it('asks the provider for a scene even when nothing declared the type', async () => {
      registerMetadata('1', { id: '1', path: 'res://scenes/typeless.tscn', type: '' });

      processor.request('res://scenes/raw.tscn');
      processor.request('1');
      await new Promise((r) => setTimeout(r, 20));

      expect(mockProvider.loadResource).toHaveBeenCalledWith('res://scenes/raw.tscn', 'PackedScene');
      expect(mockProvider.loadResource).toHaveBeenCalledWith(
        'res://scenes/typeless.tscn',
        'PackedScene'
      );
    });
  });

  describe('content validation', () => {
    it('fails when content is not a string', async () => {
      const handler = vi.fn();
      eventBus.on<Error>('scene', 'failed', handler);
      mockProvider.loadResource = vi.fn().mockResolvedValue(new ArrayBuffer(8));
      registerMetadata('scene1', { id: 'scene1', path: 'res://scenes/room.tscn', type: 'PackedScene' });

      processor.request('scene1');
      await new Promise((r) => setTimeout(r, 20));

      const [, error] = handler.mock.calls[0]!;
      expect(error.message).toContain('must be text content');
    });
  });

  describe('getCached()', () => {
    it('returns undefined for never-requested ID', () => {
      expect(processor.getCached('nonexistent')).toBeUndefined();
    });

    it('returns scene after successful load', async () => {
      registerMetadata('scene1', { id: 'scene1', path: 'res://scenes/room.tscn', type: 'PackedScene' });
      processor.request('scene1');
      await eventBus.once<TscnScene>('scene', 'loaded', 'scene1');

      const cached = processor.getCached('scene1');
      expect(cached).toBeDefined();
      expect(cached!.nodes).toBeDefined();
    });

    it('returns null for failed load (cached failure)', async () => {
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Fail'));
      registerMetadata('scene1', { id: 'scene1', path: 'res://scenes/room.tscn', type: 'PackedScene' });

      processor.request('scene1');
      await new Promise((r) => setTimeout(r, 50));

      expect(processor.getCached('scene1')).toBeNull();
    });
  });

  describe('clearCache during loading', () => {
    it('clears inflight set when clearCache called while loading', async () => {
      mockProvider.loadResource = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(VALID_TSCN_CONTENT), 100))
      );
      registerMetadata('scene1', { id: 'scene1', path: 'res://scenes/room.tscn', type: 'PackedScene' });

      processor.request('scene1');
      expect(processor.isLoading('scene1')).toBe(true);

      processor.clearCache('scene1');
      expect(processor.isLoading('scene1')).toBe(false);
    });
  });

  describe('reload after failure', () => {
    it('reloads successfully after clearing a failed entry', async () => {
      mockProvider.loadResource = vi.fn().mockRejectedValue(new Error('Network error'));
      registerMetadata('scene1', { id: 'scene1', path: 'res://scenes/room.tscn', type: 'PackedScene' });

      processor.request('scene1');
      await new Promise((r) => setTimeout(r, 50));
      expect(processor.getCached('scene1')).toBeNull();

      processor.clearCache('scene1');
      mockProvider.loadResource = vi.fn().mockResolvedValue(VALID_TSCN_CONTENT);

      processor.request('scene1');
      const scene = await eventBus.once<TscnScene>('scene', 'loaded', 'scene1');
      expect(scene).toBeDefined();
      expect(scene!.nodes).toBeDefined();
    });
  });

  describe('content gate (supersedes the old fully-lenient behavior)', () => {
    // The TscnParser recovers from errors INSIDE a scene, but content that
    // is not a text scene at all (empty file, HTML fallback, binary RSRC)
    // used to "parse" into an empty scene — the instanced subtree silently
    // vanished with no placeholder and no missing-resources row. Such
    // content now fails the load; lenient recovery still applies to
    // malformed lines within a real [gd_scene] file.

    it('rejects empty content (no [gd_scene header)', async () => {
      mockProvider.loadResource = vi.fn().mockResolvedValue('');
      registerMetadata('scene1', { id: 'scene1', path: 'res://scenes/room.tscn', type: 'PackedScene' });

      const failedHandler = vi.fn();
      eventBus.on<Error>('scene', 'failed', failedHandler);

      processor.request('scene1');
      await new Promise((r) => setTimeout(r, 50));

      expect(failedHandler).toHaveBeenCalled();
    });

    it('still parses leniently INSIDE a real scene (malformed lines recovered)', async () => {
      mockProvider.loadResource = vi
        .fn()
        .mockResolvedValue('[gd_scene format=3]\n\n[node name="A" type="Node3D"]\ngarbage line\n');
      registerMetadata('scene1', { id: 'scene1', path: 'res://scenes/room.tscn', type: 'PackedScene' });

      const loadedHandler = vi.fn();
      eventBus.on<TscnScene>('scene', 'loaded', loadedHandler);

      processor.request('scene1');
      await new Promise((r) => setTimeout(r, 50));

      expect(loadedHandler).toHaveBeenCalled();
      const [, scene] = loadedHandler.mock.calls[0]!;
      expect(scene.nodes).toHaveLength(1);
    });

    it('loads a scene whose [gd_scene] header is preceded by ; comment lines', async () => {
      // A leading comment block is valid and renders at top level, so it must
      // also load when instanced; the guard used to demand the tag on line 1,
      // silently vanishing the instanced subtree.
      mockProvider.loadResource = vi
        .fn()
        .mockResolvedValue('; a documentation header\n; second line\n\n[gd_scene format=3]\n\n[node name="A" type="Node3D"]\n');
      registerMetadata('scene1', { id: 'scene1', path: 'res://scenes/room.tscn', type: 'PackedScene' });

      const loadedHandler = vi.fn();
      eventBus.on<TscnScene>('scene', 'loaded', loadedHandler);

      processor.request('scene1');
      await new Promise((r) => setTimeout(r, 50));

      expect(loadedHandler).toHaveBeenCalled();
      const [, scene] = loadedHandler.mock.calls[0]!;
      expect(scene.nodes).toHaveLength(1);
    });
  });

  /**
   * PackedScene references can point at .glb / .gltf binary
   * files (e.g. a fixture's chest.glb or lamp.glb).
   * Previously the processor threw "Scene must be text content" on
   * ArrayBuffer input; users saw magenta placeholders instead of the
   * actual models. Now the processor branches on path
   * extension and synthesises a single-node `GLBSceneRoot` TscnScene
   * for binary inputs; the R3F dispatch then routes through the
   * GLBSceneRoot component which loads via `useResource('GLBMesh', ...)`.
   */
  describe('GLB / GLTF PackedScene (WI-HALL-3)', () => {
    it('accepts ArrayBuffer content for a .glb path and synthesises a single-node scene', async () => {
      // The provider returns binary for .glb (per
      // `isBinaryResourceType('PackedScene', '...glb') === true`).
      const buffer = new ArrayBuffer(8);
      mockProvider.loadResource = vi.fn().mockResolvedValue(buffer);
      registerMetadata('frame1', {
        id: 'frame1',
        path: 'res://models/chest.glb',
        type: 'PackedScene',
      });

      processor.request('frame1');
      const scene = await eventBus.once<TscnScene>('scene', 'loaded', 'frame1');

      expect(scene).toBeDefined();
      expect(scene!.nodes).toHaveLength(1);
      const root = scene!.nodes[0]!;
      // The synthesised root is the GLBSceneRoot node type — the R3F
      // dispatcher routes this through the GLBSceneRoot component which
      // owns the actual GLB load lifecycle.
      expect(root.type).toBe('GLBSceneRoot');
      // The basename (no extension) is used so the SceneTreeViewer
      // shows a meaningful label after sub-scene inlining lands.
      expect(root.name).toBe('chest');
      // The GLB path is carried verbatim on the synthesised node's
      // properties so the consumer can load it via useResource.
      expect((root.properties as Record<string, unknown>).glbPath).toBe(
        'res://models/chest.glb'
      );
      // No children / no resource refs on a synthesised scene — the GLB
      // hierarchy lives inside the THREE.Object3D returned by the
      // GLBMesh processor.
      expect(root.children).toHaveLength(0);
      expect(scene!.externalResources).toHaveLength(0);
      expect(scene!.internalResources).toHaveLength(0);
    });

    it('accepts ArrayBuffer content for a .gltf path the same way', async () => {
      const buffer = new ArrayBuffer(8);
      mockProvider.loadResource = vi.fn().mockResolvedValue(buffer);
      registerMetadata('gltf1', {
        id: 'gltf1',
        path: 'res://models/asset.gltf',
        type: 'PackedScene',
      });

      processor.request('gltf1');
      const scene = await eventBus.once<TscnScene>('scene', 'loaded', 'gltf1');

      expect(scene!.nodes[0]!.type).toBe('GLBSceneRoot');
      expect(scene!.nodes[0]!.name).toBe('asset');
    });

    it('rejects string content for a .glb path with a descriptive error', async () => {
      // Sanity: a binary path that somehow returned text should fail
      // loudly so the caller doesn't get a malformed synthesised scene.
      mockProvider.loadResource = vi.fn().mockResolvedValue('not binary');
      registerMetadata('frame1', {
        id: 'frame1',
        path: 'res://models/x.glb',
        type: 'PackedScene',
      });

      const failHandler = vi.fn();
      eventBus.on<Error>('scene', 'failed', failHandler);

      processor.request('frame1');
      await new Promise((r) => setTimeout(r, 20));

      expect(failHandler).toHaveBeenCalled();
      const [, error] = failHandler.mock.calls[0]!;
      expect(error.message).toMatch(/GLB\/GLTF must be binary/);
    });

    it('still rejects ArrayBuffer content for a .tscn path (sanity)', async () => {
      // The branch is path-extension driven, not content-type driven —
      // a .tscn path that somehow got binary content is still an error.
      const buffer = new ArrayBuffer(8);
      mockProvider.loadResource = vi.fn().mockResolvedValue(buffer);
      registerMetadata('scene1', {
        id: 'scene1',
        path: 'res://scenes/room.tscn',
        type: 'PackedScene',
      });

      const failHandler = vi.fn();
      eventBus.on<Error>('scene', 'failed', failHandler);

      processor.request('scene1');
      await new Promise((r) => setTimeout(r, 20));

      expect(failHandler).toHaveBeenCalled();
      const [, error] = failHandler.mock.calls[0]!;
      expect(error.message).toMatch(/TSCN scene must be text content/);
    });
  });
});
