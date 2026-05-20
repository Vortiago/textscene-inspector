/**
 * WI-UX-3 regression: useResource reports missing paths to the
 * MissingResourcesContext, so the DOM panel can aggregate them.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import * as THREE from 'three';
import type { ReactNode } from 'react';
import { useResource } from './useResource';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import { ResourceEventBus } from './ResourceEventBus';
import { MetadataStore } from './MetadataStore';
import type { ResourceLoader } from './ResourceLoader';
import {
  MissingResourcesProvider,
  useMissingResources,
} from '../r3f/contexts/MissingResourcesContext';

interface MockTextureProcessor {
  cache: Map<string, THREE.Texture | null>;
  request(_path: string): void;
  getCached(path: string): THREE.Texture | null | undefined;
  isCached(path: string): boolean;
  isLoading(): boolean;
  clearCache(path?: string): void;
  getCacheSize(): number;
  _resolve(path: string, value: THREE.Texture): void;
}

function makeMockLoader(): {
  loader: ResourceLoader;
  textures: MockTextureProcessor;
} {
  const eventBus = new ResourceEventBus();
  const metadata = new MetadataStore();
  const makeProcessor = <T,>() => {
    const cache = new Map<string, T | null>();
    return {
      cache,
      request(_path: string): void {},
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
    };
  };

  const textures = makeProcessor<THREE.Texture>();
  // Seed the cache with a sentinel `null` so the hook resolves
  // synchronously to `missing` instead of staying `pending`.
  textures.cache.set('res://textures/missing.png', null);

  // Test-only convenience: simulate a successful load + bus emit so the
  // missing → loaded transition can be driven from a test.
  const texturesWithResolve = Object.assign(textures, {
    _resolve(path: string, value: THREE.Texture): void {
      textures.cache.set(path, value);
      eventBus.emit('texture', 'loaded', path, value);
    },
  }) as MockTextureProcessor;

  const loader = {
    eventBus,
    metadata,
    textures: texturesWithResolve,
    materials: makeProcessor<THREE.Material>(),
    glbMeshes: makeProcessor<THREE.Object3D>(),
    getSceneCached: () => undefined,
    requestScene: () => {},
    provideFile(): void {},
    clear(): void {},
  };
  return { loader: loader as unknown as ResourceLoader, textures: texturesWithResolve };
}

function makeWrappers(loader: ResourceLoader) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MissingResourcesProvider>
        <ResourceLoaderProvider loader={loader}>
          {children}
        </ResourceLoaderProvider>
      </MissingResourcesProvider>
    );
  };
}

describe('useResource → MissingResourcesContext aggregation', () => {
  let loader: ResourceLoader;
  let textures: MockTextureProcessor;

  beforeEach(() => {
    ({ loader, textures } = makeMockLoader());
  });

  it('reports the path to MissingResourcesContext when the resource resolves to missing', () => {
    const Wrapper = makeWrappers(loader);
    // Combined hook that reads both the resource status and the
    // aggregated missing-paths set under the same provider tree.
    const { result } = renderHook(
      () => {
        const res = useResource<THREE.Texture>('res://textures/missing.png', 'Texture2D');
        const { missingPaths } = useMissingResources();
        return { res, missingPaths };
      },
      { wrapper: Wrapper }
    );

    expect(result.current.res.status).toBe('missing');
    expect(result.current.missingPaths.has('res://textures/missing.png')).toBe(true);
  });

  it('does not report when the path is empty (no-request short-circuit)', () => {
    const Wrapper = makeWrappers(loader);
    const { result } = renderHook(
      () => {
        const res = useResource<THREE.Texture>('', 'Texture2D');
        const { missingPaths } = useMissingResources();
        return { res, missingPaths };
      },
      { wrapper: Wrapper }
    );

    expect(result.current.res.status).toBe('pending');
    expect(result.current.missingPaths.size).toBe(0);
  });

  it('clears the path from the missing set when the consuming hook unmounts', () => {
    const Wrapper = makeWrappers(loader);

    // Switch the hook's path between the test path and empty (no-op) so
    // mounting/unmounting is modeled via path swap. Empty path returns
    // pending and triggers the unmount cleanup of the prior missing
    // report effect.
    const { result, rerender } = renderHook(
      ({ path }: { path: string }) => {
        useResource<THREE.Texture>(path, 'Texture2D');
        const { missingPaths } = useMissingResources();
        return missingPaths;
      },
      {
        wrapper: Wrapper,
        initialProps: { path: 'res://textures/missing.png' },
      }
    );

    expect(result.current.has('res://textures/missing.png')).toBe(true);

    rerender({ path: '' });

    expect(result.current.has('res://textures/missing.png')).toBe(false);
  });

  it('promotes a previously-missing path to uploadedPaths when it transitions to loaded (WI-UX-6)', () => {
    const Wrapper = makeWrappers(loader);

    const { result } = renderHook(
      () => {
        useResource<THREE.Texture>('res://textures/missing.png', 'Texture2D');
        const { missingPaths, uploadedPaths } = useMissingResources();
        return { missingPaths, uploadedPaths };
      },
      { wrapper: Wrapper }
    );

    // Initial: resolved synchronously to missing via the seeded null cache.
    expect(result.current.missingPaths.has('res://textures/missing.png')).toBe(true);
    expect(result.current.uploadedPaths.has('res://textures/missing.png')).toBe(false);

    // Simulate the host providing the file: clear the failure cache and
    // emit a `loaded` event for the same path. `useResource` should pick
    // it up via the bus subscription and transition status to `loaded`,
    // which (per WI-UX-6) calls `markUploaded(path)`.
    act(() => {
      textures.clearCache('res://textures/missing.png');
      textures._resolve('res://textures/missing.png', new THREE.Texture());
    });

    expect(result.current.missingPaths.has('res://textures/missing.png')).toBe(false);
    expect(result.current.uploadedPaths.has('res://textures/missing.png')).toBe(true);
  });

  it('does NOT add to uploadedPaths when a path loads without ever being missing (WI-UX-6)', () => {
    // Drop the seeded null; the cache lookup falls through to the
    // request path and the subscription waits for the loaded event.
    textures.cache.delete('res://textures/missing.png');

    const Wrapper = makeWrappers(loader);

    const { result } = renderHook(
      () => {
        useResource<THREE.Texture>('res://textures/never-missing.png', 'Texture2D');
        const { missingPaths, uploadedPaths } = useMissingResources();
        return { missingPaths, uploadedPaths };
      },
      { wrapper: Wrapper }
    );

    // Drive a `loaded` event before any `missing` ever happens.
    act(() => {
      textures._resolve('res://textures/never-missing.png', new THREE.Texture());
    });

    // Normal fixture resource — shouldn't show up in either panel set.
    expect(result.current.missingPaths.size).toBe(0);
    expect(result.current.uploadedPaths.size).toBe(0);
  });
});
