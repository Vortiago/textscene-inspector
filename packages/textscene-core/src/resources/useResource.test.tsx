/**
 * Tests for the useResource hook. Exercises the public contract from
 * R3F-contracts.md §1: status transitions, identity equality vs Object3D
 * clone semantics, and the late-arrival flow (the WI-R3F-2 hard gate).
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { renderHook, act, render } from '@testing-library/react';
import * as THREE from 'three';
import { StrictMode, type ReactNode } from 'react';
import { useResource } from './useResource';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import type { ResourceLoader } from './ResourceLoader';
import { createFakeResourceLoader, type FakeProcessor } from './testing/createFakeResourceLoader';
import { initGlbModules } from './processing/glbProcessing';

/**
 * A fake ResourceLoader whose cache + event emits these hook tests drive
 * directly. The shared `createFakeResourceLoader` fixture holds the
 * assembly; `MockLoader` narrows the loader's processor handles back to
 * their driving API (`_resolve` / `_fail` / `setRequestImpl` / `cache`).
 */
type MockLoader = ResourceLoader & {
  textures: FakeProcessor<THREE.Texture>;
  materials: FakeProcessor<THREE.Material>;
  glbMeshes: FakeProcessor<THREE.Object3D>;
};

function makeMockLoader(): MockLoader {
  return createFakeResourceLoader().loader as unknown as MockLoader;
}

function withLoader(loader: ResourceLoader) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>;
  };
}

// GLBMesh tests call cloneWithMaterials (via the hook), which requires
// SkeletonUtils to be lazily loaded first. Initialise once for the file.
beforeAll(async () => {
  await initGlbModules();
});

describe('useResource', () => {
  let loader: MockLoader;
  let textureA: THREE.Texture;
  let textureB: THREE.Texture;

  beforeEach(() => {
    loader = makeMockLoader() as unknown as MockLoader;
    textureA = new THREE.Texture();
    textureA.name = 'A';
    textureB = new THREE.Texture();
    textureB.name = 'B';
  });

  it('happy path: returns loaded with the cached value when the texture is already in cache', () => {
    loader.textures.cache.set('res://t.png', textureA);

    const { result } = renderHook(
      () => useResource<THREE.Texture>('res://t.png', 'Texture2D'),
      { wrapper: withLoader(loader) }
    );

    expect(result.current.status).toBe('loaded');
    expect(result.current.value).toBe(textureA);
    expect(result.current.error).toBeUndefined();
  });

  it('pending -> loaded: starts pending, transitions on bus event', () => {
    const requestSpy = vi.fn((path: string) => {
      // Simulate async-ish behavior: the request method just records;
      // the test drives the resolution via _resolve below.
      void path;
    });
    loader.textures.setRequestImpl(requestSpy);

    const { result } = renderHook(
      () => useResource<THREE.Texture>('res://t.png', 'Texture2D'),
      { wrapper: withLoader(loader) }
    );

    expect(result.current.status).toBe('pending');
    expect(result.current.value).toBeUndefined();
    expect(requestSpy).toHaveBeenCalledWith('res://t.png');

    act(() => {
      loader.textures._resolve('res://t.png', textureA);
    });

    expect(result.current.status).toBe('loaded');
    expect(result.current.value).toBe(textureA);
  });

  it('pending -> unavailable: emits failed event and the hook reports unavailable without value', () => {
    loader.textures.setRequestImpl(() => {});

    const { result } = renderHook(
      () => useResource<THREE.Texture>('res://gone.png', 'Texture2D'),
      { wrapper: withLoader(loader) }
    );

    expect(result.current.status).toBe('pending');

    act(() => {
      loader.textures._fail('res://gone.png', 'File not found');
    });

    expect(result.current.status).toBe('unavailable');
    expect(result.current.value).toBeUndefined();
    expect(result.current.error).toBe('File not found');
  });

  it('parse-style failure messages still report unavailable (no message-sniffing)', () => {
    loader.textures.setRequestImpl(() => {});

    const { result } = renderHook(
      () => useResource<THREE.Texture>('res://broken.png', 'Texture2D'),
      { wrapper: withLoader(loader) }
    );

    act(() => {
      loader.textures._fail('res://broken.png', 'failed to parse/decode image');
    });

    // Every load failure maps to the single `unavailable` status — the
    // error string carries the human-readable detail for diagnostics.
    expect(result.current.status).toBe('unavailable');
    expect(result.current.error).toBe('failed to parse/decode image');
  });

  // -------------------------------------------------------------------
  // THE WI-R3F-2 HARD GATE — `missing → loaded` late-arrival.
  // -------------------------------------------------------------------
  it('unavailable -> loaded: the late-arrival hard gate fires a loaded event after a previous failure', () => {
    loader.textures.setRequestImpl(() => {});

    const { result } = renderHook(
      () => useResource<THREE.Texture>('res://late.png', 'Texture2D'),
      { wrapper: withLoader(loader) }
    );

    // 1. Initial state: hook fires request, status pending.
    expect(result.current.status).toBe('pending');

    // 2. Host fails the initial request (no file uploaded yet).
    act(() => {
      loader.textures._fail('res://late.png', 'File not found');
    });
    expect(result.current.status).toBe('unavailable');
    expect(result.current.value).toBeUndefined();

    // 3. Later, the host provides the file. The real ResourceLoader.provideFile
    //    clears the cache and re-routes through the processor; here we
    //    simulate the resulting emit directly because the mock loader's
    //    `request` is a no-op.
    act(() => {
      // Mimic clearCache(path) clearing the failed null entry, then a
      // fresh loaded event firing from the late re-load.
      loader.textures.cache.delete('res://late.png');
      loader.textures._resolve('res://late.png', textureA);
    });

    // 4. Subscribers re-render with status loaded and the now-available value.
    expect(result.current.status).toBe('loaded');
    expect(result.current.value).toBe(textureA);
    expect(result.current.error).toBeUndefined();
  });

  it('multiple consumers: two hooks reading the same path both transition on a single resolve', () => {
    loader.textures.setRequestImpl(() => {});

    const consumerA = renderHook(
      () => useResource<THREE.Texture>('res://shared.png', 'Texture2D'),
      { wrapper: withLoader(loader) }
    );
    const consumerB = renderHook(
      () => useResource<THREE.Texture>('res://shared.png', 'Texture2D'),
      { wrapper: withLoader(loader) }
    );

    expect(consumerA.result.current.status).toBe('pending');
    expect(consumerB.result.current.status).toBe('pending');

    act(() => {
      loader.textures._resolve('res://shared.png', textureA);
    });

    expect(consumerA.result.current.status).toBe('loaded');
    expect(consumerB.result.current.status).toBe('loaded');
    // For non-Object3D resources the contract requires identity equality.
    expect(consumerA.result.current.value).toBe(consumerB.result.current.value);
  });

  it('Object3D clone: two GLBMesh consumers receive distinct clones, not the cached template', () => {
    loader.glbMeshes.setRequestImpl(() => {});

    // Build a template Object3D with one child mesh + material so we can
    // observe that the clone copies structure and that the materials are
    // also cloned (per cloneWithMaterials).
    const template = new THREE.Object3D();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    template.add(mesh);

    const consumerA = renderHook(
      () => useResource<THREE.Object3D>('res://glb.glb', 'GLBMesh'),
      { wrapper: withLoader(loader) }
    );
    const consumerB = renderHook(
      () => useResource<THREE.Object3D>('res://glb.glb', 'GLBMesh'),
      { wrapper: withLoader(loader) }
    );

    act(() => {
      loader.glbMeshes._resolve('res://glb.glb', template);
    });

    const a = consumerA.result.current.value!;
    const b = consumerB.result.current.value!;

    expect(a).toBeDefined();
    expect(b).toBeDefined();
    // Different instances (different uuids) — single-parent rule.
    expect(a.uuid).not.toBe(b.uuid);
    expect(a).not.toBe(b);
    // Neither consumer received the original template.
    expect(a).not.toBe(template);
    expect(b).not.toBe(template);
    // Structure is preserved: each clone has one child mesh.
    expect(a.children).toHaveLength(1);
    expect(b.children).toHaveLength(1);
    // Materials are cloned, not shared.
    const matA = (a.children[0] as THREE.Mesh).material as THREE.Material;
    const matB = (b.children[0] as THREE.Mesh).material as THREE.Material;
    expect(matA).not.toBe(matB);
    expect(matA.uuid).not.toBe(matB.uuid);
  });

  // -------------------------------------------------------------------
  // Per-consumer GLB clone disposal (materials only; geometry is shared
  // with the cached template and every other consumer's clone via
  // `cloneWithMaterials`, so disposing it here would corrupt them).
  // -------------------------------------------------------------------
  it('disposes the cloned material on unmount, but never the shared geometry', () => {
    loader.glbMeshes.setRequestImpl(() => {});

    const template = new THREE.Object3D();
    const geometry = new THREE.BoxGeometry();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    template.add(mesh);

    const { result, unmount } = renderHook(
      () => useResource<THREE.Object3D>('res://glb.glb', 'GLBMesh'),
      { wrapper: withLoader(loader) }
    );

    act(() => {
      loader.glbMeshes._resolve('res://glb.glb', template);
    });

    const clone = result.current.value!;
    const clonedMesh = clone.children[0] as THREE.Mesh;
    const materialDisposeSpy = vi.spyOn(clonedMesh.material as THREE.Material, 'dispose');
    const geometryDisposeSpy = vi.spyOn(geometry, 'dispose');

    unmount();

    expect(materialDisposeSpy).toHaveBeenCalledTimes(1);
    // Geometry is shared (never cloned) — disposing it here would break
    // the cached template and any other live consumer.
    expect(geometryDisposeSpy).not.toHaveBeenCalled();
  });

  it('disposes the previous clone materials when the path changes (no leak across path-swap)', () => {
    loader.glbMeshes.setRequestImpl(() => {});

    const templateA = new THREE.Object3D();
    const meshA = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    templateA.add(meshA);
    loader.glbMeshes.cache.set('res://a.glb', templateA);

    const templateB = new THREE.Object3D();
    const meshB = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    templateB.add(meshB);
    loader.glbMeshes.cache.set('res://b.glb', templateB);

    const { result, rerender } = renderHook(
      ({ path }: { path: string }) => useResource<THREE.Object3D>(path, 'GLBMesh'),
      { wrapper: withLoader(loader), initialProps: { path: 'res://a.glb' } }
    );

    const cloneA = result.current.value!;
    const materialASpy = vi.spyOn((cloneA.children[0] as THREE.Mesh).material as THREE.Material, 'dispose');

    rerender({ path: 'res://b.glb' });

    expect(materialASpy).toHaveBeenCalledTimes(1);
    expect(result.current.value).not.toBe(cloneA);
  });

  it('cache hit: re-rendering with the same path does not refire the loader request', () => {
    const requestSpy = vi.fn(() => {});
    loader.textures.setRequestImpl(requestSpy);

    // Preload the cache so the first render hits the synchronous fast path.
    loader.textures.cache.set('res://cached.png', textureA);

    let renderCount = 0;
    function TestComp() {
      renderCount += 1;
      const result = useResource<THREE.Texture>('res://cached.png', 'Texture2D');
      return <span data-testid="status">{result.status}</span>;
    }

    const { rerender } = render(
      <ResourceLoaderProvider loader={loader as unknown as ResourceLoader}>
        <TestComp />
      </ResourceLoaderProvider>
    );

    expect(requestSpy).not.toHaveBeenCalled();

    rerender(
      <ResourceLoaderProvider loader={loader as unknown as ResourceLoader}>
        <TestComp />
      </ResourceLoaderProvider>
    );
    rerender(
      <ResourceLoaderProvider loader={loader as unknown as ResourceLoader}>
        <TestComp />
      </ResourceLoaderProvider>
    );

    expect(requestSpy).not.toHaveBeenCalled();
    // We rendered three times — the component ran, but no new request fired.
    expect(renderCount).toBeGreaterThanOrEqual(3);
  });

  it('reports unavailable (with a diagnostic error string) when no ResourceLoader is provided', () => {
    const { result } = renderHook(() =>
      useResource<THREE.Texture>('res://t.png', 'Texture2D')
    );

    // The no-provider case is a programming error, but it surfaces through
    // the same `unavailable` status as a missing resource — callers render
    // their placeholder either way. The descriptive `error` string is kept
    // so a developer who forgot the provider can still diagnose it.
    expect(result.current.status).toBe('unavailable');
    expect(result.current.value).toBeUndefined();
    expect(result.current.error).toMatch(/outside <ResourceLoaderProvider>/);
  });

  it('ignores events for other paths', () => {
    loader.textures.setRequestImpl(() => {});

    const { result } = renderHook(
      () => useResource<THREE.Texture>('res://mine.png', 'Texture2D'),
      { wrapper: withLoader(loader) }
    );

    expect(result.current.status).toBe('pending');

    act(() => {
      loader.textures._resolve('res://other.png', textureB);
    });

    // Still pending — the other path's event must not affect this consumer.
    expect(result.current.status).toBe('pending');
  });

  it('material resource type routes through the material processor', () => {
    const material = new THREE.MeshBasicMaterial();
    loader.materials.setRequestImpl(() => {});

    const { result } = renderHook(
      () => useResource<THREE.Material>('res://mat.tres', 'StandardMaterial3D'),
      { wrapper: withLoader(loader) }
    );

    act(() => {
      loader.materials._resolve('res://mat.tres', material);
    });

    expect(result.current.status).toBe('loaded');
    expect(result.current.value).toBe(material);
  });

  // -------------------------------------------------------------------
  // Unmount / path-swap races.
  // -------------------------------------------------------------------
  describe('unmount and path-swap races', () => {
    it('removes its loaded/failed bus listeners on unmount (no leaked subscriptions)', () => {
      loader.textures.setRequestImpl(() => {});
      const before = loader.eventBus.getHandlerCount('texture', 'loaded');
      const beforeFailed = loader.eventBus.getHandlerCount('texture', 'failed');

      const { unmount } = renderHook(
        () => useResource<THREE.Texture>('res://t.png', 'Texture2D'),
        { wrapper: withLoader(loader) }
      );

      expect(loader.eventBus.getHandlerCount('texture', 'loaded')).toBe(before + 1);
      expect(loader.eventBus.getHandlerCount('texture', 'failed')).toBe(beforeFailed + 1);

      unmount();

      expect(loader.eventBus.getHandlerCount('texture', 'loaded')).toBe(before);
      expect(loader.eventBus.getHandlerCount('texture', 'failed')).toBe(beforeFailed);
    });

    it('swapping path unsubscribes the old path listener and subscribes a fresh one (no net growth)', () => {
      loader.textures.setRequestImpl(() => {});
      const before = loader.eventBus.getHandlerCount('texture', 'loaded');

      const { rerender } = renderHook(
        ({ path }: { path: string }) => useResource<THREE.Texture>(path, 'Texture2D'),
        { wrapper: withLoader(loader), initialProps: { path: 'res://a.png' } }
      );

      expect(loader.eventBus.getHandlerCount('texture', 'loaded')).toBe(before + 1);

      rerender({ path: 'res://b.png' });

      // One old handler removed, one new handler added — net count unchanged,
      // not accumulating a handler per path visited.
      expect(loader.eventBus.getHandlerCount('texture', 'loaded')).toBe(before + 1);
    });

    it('a stale resolve for the path the consumer swapped AWAY FROM does not affect the current state', () => {
      loader.textures.setRequestImpl(() => {});

      const { result, rerender } = renderHook(
        ({ path }: { path: string }) => useResource<THREE.Texture>(path, 'Texture2D'),
        { wrapper: withLoader(loader), initialProps: { path: 'res://a.png' } }
      );

      expect(result.current.status).toBe('pending');

      rerender({ path: 'res://b.png' });
      expect(result.current.status).toBe('pending');

      // The late arrival belongs to the path this consumer left behind.
      act(() => {
        loader.textures._resolve('res://a.png', textureA);
      });

      // Must still reflect 'res://b.png' — a stale event for the
      // abandoned path must never resurrect it into the current result.
      expect(result.current.status).toBe('pending');
      expect(result.current.value).toBeUndefined();

      // The CURRENT path resolving still works normally afterwards.
      act(() => {
        loader.textures._resolve('res://b.png', textureB);
      });
      expect(result.current.status).toBe('loaded');
      expect(result.current.value).toBe(textureB);
    });

    it('path === "": stays pending forever, never subscribes, and never requests', () => {
      const requestSpy = vi.fn();
      loader.textures.setRequestImpl(requestSpy);
      const before = loader.eventBus.getHandlerCount('texture', 'loaded');

      const { result } = renderHook(
        () => useResource<THREE.Texture>('', 'Texture2D'),
        { wrapper: withLoader(loader) }
      );

      expect(result.current.status).toBe('pending');
      expect(result.current.value).toBeUndefined();
      expect(requestSpy).not.toHaveBeenCalled();
      expect(loader.eventBus.getHandlerCount('texture', 'loaded')).toBe(before);
    });
  });

  // -------------------------------------------------------------------
  // Reference-counting: pin / unpin wiring.
  // The hook must increment the processor pin count on mount and
  // decrement on unmount so the LRU cache never evicts a cached entry
  // that a mounted consumer still holds.
  // -------------------------------------------------------------------
  describe('pin / unpin lifecycle', () => {
    it('pins the resource on mount and unpins on unmount', () => {
      loader.textures.cache.set('res://t.png', textureA);

      const { unmount } = renderHook(
        () => useResource<THREE.Texture>('res://t.png', 'Texture2D'),
        { wrapper: withLoader(loader) }
      );

      expect(loader.textures.pinCounts.get('res://t.png')).toBe(1);

      unmount();

      expect(loader.textures.pinCounts.get('res://t.png')).toBeUndefined();
    });

    it('two concurrent consumers each add a pin; both must unpin before count reaches zero', () => {
      loader.textures.cache.set('res://t.png', textureA);

      const hookA = renderHook(
        () => useResource<THREE.Texture>('res://t.png', 'Texture2D'),
        { wrapper: withLoader(loader) }
      );
      const hookB = renderHook(
        () => useResource<THREE.Texture>('res://t.png', 'Texture2D'),
        { wrapper: withLoader(loader) }
      );

      expect(loader.textures.pinCounts.get('res://t.png')).toBe(2);

      hookA.unmount();
      expect(loader.textures.pinCounts.get('res://t.png')).toBe(1);

      hookB.unmount();
      expect(loader.textures.pinCounts.get('res://t.png')).toBeUndefined();
    });

    it('path swap unpins the old path and pins the new path', () => {
      loader.textures.cache.set('res://a.png', textureA);
      loader.textures.cache.set('res://b.png', textureB);

      const { rerender } = renderHook(
        ({ path }: { path: string }) => useResource<THREE.Texture>(path, 'Texture2D'),
        { wrapper: withLoader(loader), initialProps: { path: 'res://a.png' } }
      );

      expect(loader.textures.pinCounts.get('res://a.png')).toBe(1);
      expect(loader.textures.pinCounts.get('res://b.png')).toBeUndefined();

      rerender({ path: 'res://b.png' });

      expect(loader.textures.pinCounts.get('res://a.png')).toBeUndefined();
      expect(loader.textures.pinCounts.get('res://b.png')).toBe(1);
    });

    it('StrictMode double-invoke: mount->unmount->mount ends at pin count 1 and never evicts', () => {
      // A real <StrictMode> wrapper makes React run the effect, its
      // cleanup, then the effect again on mount. Net result must be
      // pin count = 1, with no disposal in the gap.
      loader.textures.cache.set('res://t.png', textureA);
      const StrictWrapper = ({ children }: { children: ReactNode }) => (
        <StrictMode>
          <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>
        </StrictMode>
      );

      const { result, unmount } = renderHook(
        () => useResource<THREE.Texture>('res://t.png', 'Texture2D'),
        { wrapper: StrictWrapper }
      );

      expect(loader.textures.pinCounts.get('res://t.png')).toBe(1);
      expect(result.current.status).toBe('loaded');
      // The resource must still be in cache (not disposed in the gap).
      expect(loader.textures.cache.has('res://t.png')).toBe(true);

      // The real unmount releases the last pin.
      unmount();
      expect(loader.textures.pinCounts.get('res://t.png')).toBeUndefined();
    });

    it('empty path does not pin anything', () => {
      const { unmount } = renderHook(
        () => useResource<THREE.Texture>('', 'Texture2D'),
        { wrapper: withLoader(loader) }
      );

      expect(loader.textures.pinCounts.size).toBe(0);
      unmount();
      expect(loader.textures.pinCounts.size).toBe(0);
    });
  });
});
