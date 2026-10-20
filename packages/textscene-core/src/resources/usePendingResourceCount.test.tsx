/**
 * The React view of the nearest loader's pending resource count, which tells the shell whether
 * the scene's resources have landed.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import { createFakeResourceLoader } from './testing/createFakeResourceLoader';
import { usePendingResourceCount } from './usePendingResourceCount';

function renderWithLoader(loader = createFakeResourceLoader().loader) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>
  );
  return { loader, ...renderHook(() => usePendingResourceCount(), { wrapper }) };
}

describe('usePendingResourceCount', () => {
  it('follows the count from zero, up, and back to zero', () => {
    const { loader, result } = renderWithLoader();
    expect(result.current).toBe(0);

    let release: () => void = () => {};
    act(() => {
      release = loader.beginPending();
    });
    expect(result.current).toBe(1);

    act(() => release());
    expect(result.current).toBe(0);
  });

  it('unsubscribes from the loader once unmounted (edge case)', () => {
    const { loader } = createFakeResourceLoader();
    const unsubscribes: ReturnType<typeof vi.fn>[] = [];
    const subscribe = loader.subscribePending.bind(loader);
    vi.spyOn(loader, 'subscribePending').mockImplementation((listener) => {
      const unsubscribe = vi.fn(subscribe(listener));
      unsubscribes.push(unsubscribe);
      return unsubscribe;
    });
    const { unmount } = renderWithLoader(loader);
    expect(unsubscribes.length).toBeGreaterThan(0);

    unmount();

    expect(unsubscribes.every((unsubscribe) => unsubscribe.mock.calls.length > 0)).toBe(true);
  });

  it('answers zero outside a loader (error case)', () => {
    const { result } = renderHook(() => usePendingResourceCount());
    expect(result.current).toBe(0);
  });
});
