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
import type { ResourceLoader } from './ResourceLoader';
import { createFakeResourceLoader, type FakeProcessor } from './testing/createFakeResourceLoader';
import {
  MissingResourcesProvider,
  useMissingResources,
} from '../r3f/contexts/MissingResourcesContext';

function makeMockLoader(): {
  loader: ResourceLoader;
  textures: FakeProcessor<THREE.Texture>;
} {
  const fake = createFakeResourceLoader();
  // Seed a sentinel `null` so the hook resolves synchronously to
  // `missing` instead of staying `pending`.
  fake.textures.seed('res://textures/missing.png', null);
  return { loader: fake.loader, textures: fake.textures };
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
  let textures: FakeProcessor<THREE.Texture>;

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

    expect(result.current.res.status).toBe('unavailable');
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
