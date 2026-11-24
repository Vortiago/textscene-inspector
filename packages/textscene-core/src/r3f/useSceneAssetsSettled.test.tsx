import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { memoisedImport } from '../resources/memoisedImport';
import { useSceneAssetsSettled } from './useSceneAssetsSettled';

function renderWithLoader(loader = createFakeResourceLoader().loader) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>
  );
  return { loader, ...renderHook(() => useSceneAssetsSettled(), { wrapper }) };
}

/** Lets a work count's notice, which comes a microtask after the change, reach the hook. */
const noticed = () => act(async () => {});

describe('useSceneAssetsSettled', () => {
  it('is settled with no work pending', () => {
    expect(renderWithLoader().result.current).toBe(true);
  });

  it('is pending while a resource loads, and settled once it lands', () => {
    const { loader, result } = renderWithLoader();
    let release: () => void = () => {};
    act(() => {
      release = loader.beginPending();
    });
    expect(result.current).toBe(false);
    act(() => release());
    expect(result.current).toBe(true);
  });

  it('is pending while a code import loads, and settled once it lands', async () => {
    const { result } = renderWithLoader();
    let land!: (module: object) => void;
    const landed = memoisedImport(() => new Promise<object>((resolve) => (land = resolve)))();
    await noticed();
    expect(result.current).toBe(false);
    land({});
    await act(() => landed);
    await noticed();
    expect(result.current).toBe(true);
  });

  it('stops listening to the loader once unmounted (edge case)', () => {
    const { loader } = createFakeResourceLoader();
    const unsubscribes: ReturnType<typeof vi.fn>[] = [];
    const subscribe = loader.subscribePending.bind(loader);
    vi.spyOn(loader, 'subscribePending').mockImplementation((listener) => {
      const unsubscribe = vi.fn(subscribe(listener));
      unsubscribes.push(unsubscribe);
      return unsubscribe;
    });
    const { unmount } = renderWithLoader(loader);
    unmount();
    expect(unsubscribes.every((unsubscribe) => unsubscribe.mock.calls.length > 0)).toBe(true);
  });
});
