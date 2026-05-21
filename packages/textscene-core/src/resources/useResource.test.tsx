/**
 * Tests for the useResource hook. Exercises the public contract from
 * R3F-contracts.md §1: status transitions, identity equality vs Object3D
 * clone semantics, and the late-arrival flow (the WI-R3F-2 hard gate).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, render } from '@testing-library/react';
import * as THREE from 'three';
import type { ReactNode } from 'react';
import { useResource } from './useResource';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import { ResourceEventBus } from './ResourceEventBus';
import { MetadataStore } from './MetadataStore';
import type { ResourceLoader } from './ResourceLoader';

/**
 * Build a minimal ResourceLoader stand-in: just enough surface for the
 * hook to compile and exercise its state machine. The processors are
 * hand-rolled here so each test can drive cache state and event emits
 * deterministically without spinning up FileEventBus + a provider.
 */
function makeMockLoader(): ResourceLoader {
  const eventBus = new ResourceEventBus();
  const metadata = new MetadataStore();

  /** Build a processor whose cache and request behavior tests can poke. */
  const makeProcessor = <T,>(busNs: 'texture' | 'material' | 'glb') => {
    const cache = new Map<string, T | null>();
    let requestImpl: (path: string) => void = () => {};
    return {
      cache,
      setRequestImpl(impl: (path: string) => void): void {
        requestImpl = impl;
      },
      // Public ResourceProcessor surface used by useResource:
      request(path: string): void {
        requestImpl(path);
      },
      getCached(path: string): T | null | undefined {
        return cache.get(path);
      },
      isCached(path: string): boolean {
        return cache.has(path);
      },
      isLoading(): boolean {
        return false;
      },
      clearCache(path?: string): void {
        if (path === undefined) cache.clear();
        else cache.delete(path);
      },
      getCacheSize(): number {
        return cache.size;
      },
      /** Test-only convenience: simulate a successful load + emit. */
      _resolve(path: string, value: T): void {
        cache.set(path, value);
        eventBus.emit(busNs, 'loaded', path, value);
      },
      /** Test-only convenience: simulate a failure + emit. */
      _fail(path: string, message: string): void {
        cache.set(path, null);
        eventBus.emit<Error>(busNs, 'failed', path, new Error(message));
      },
    };
  };

  const textures = makeProcessor<THREE.Texture>('texture');
  const materials = makeProcessor<THREE.Material>('material');
  const glbMeshes = makeProcessor<THREE.Object3D>('glb');
  // WI-ARCH-2: scenes are now a peer ResourceProcessor — useResource
  // reads via `loader.scenes` directly. The mock uses the same shape.
  const scenes = makeProcessor<unknown>('scene');

  const loader = {
    eventBus,
    metadata,
    textures,
    materials,
    glbMeshes,
    scenes,
    // Legacy facade methods retained for any caller that still reaches
    // for them (currently none in production after WI-ARCH-2).
    getSceneCached: (path: string) => scenes.getCached(path) ?? undefined,
    requestScene: (path: string) => scenes.request(path),
    provideFile(path: string): void {
      // Match the real ResourceLoader.provideFile semantics: clear caches
      // then re-route. Tests usually drive _resolve directly instead.
      textures.clearCache(path);
      materials.clearCache(path);
      glbMeshes.clearCache(path);
      scenes.clearCache(path);
    },
    clear(): void {
      textures.clearCache();
      materials.clearCache();
      glbMeshes.clearCache();
      scenes.clearCache();
      eventBus.clear();
      metadata.clear();
    },
  };

  return loader as unknown as ResourceLoader;
}

type MockLoader = ReturnType<typeof makeMockLoader> & {
  textures: { _resolve(p: string, v: THREE.Texture): void; _fail(p: string, m: string): void; setRequestImpl(f: (p: string) => void): void; cache: Map<string, THREE.Texture | null> };
  materials: { _resolve(p: string, v: THREE.Material): void; _fail(p: string, m: string): void; setRequestImpl(f: (p: string) => void): void };
  glbMeshes: { _resolve(p: string, v: THREE.Object3D): void; _fail(p: string, m: string): void; setRequestImpl(f: (p: string) => void): void };
};

function withLoader(loader: ResourceLoader) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>;
  };
}

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

  it('pending -> missing: emits failed event and the hook reports missing without value', () => {
    loader.textures.setRequestImpl(() => {});

    const { result } = renderHook(
      () => useResource<THREE.Texture>('res://gone.png', 'Texture2D'),
      { wrapper: withLoader(loader) }
    );

    expect(result.current.status).toBe('pending');

    act(() => {
      loader.textures._fail('res://gone.png', 'File not found');
    });

    expect(result.current.status).toBe('missing');
    expect(result.current.value).toBeUndefined();
    expect(result.current.error).toBe('File not found');
  });

  // -------------------------------------------------------------------
  // THE WI-R3F-2 HARD GATE — `missing → loaded` late-arrival.
  // -------------------------------------------------------------------
  it('missing -> loaded: the late-arrival hard gate fires a loaded event after a previous failure', () => {
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
    expect(result.current.status).toBe('missing');
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

  it('reports error when no ResourceLoader is provided in context', () => {
    const { result } = renderHook(() =>
      useResource<THREE.Texture>('res://t.png', 'Texture2D')
    );

    expect(result.current.status).toBe('error');
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
});
