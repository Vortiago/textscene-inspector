/**
 * The React view of the nearest loader's pending resource count, which tells the shell whether
 * the scene's resources have landed.
 */
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import { createFakeResourceLoader } from './testing/createFakeResourceLoader';
import { usePendingResourceCount } from './usePendingResourceCount';

function renderWithLoader() {
  const { loader } = createFakeResourceLoader();
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

  it('stops listening once unmounted (edge case)', () => {
    const { loader, result, unmount } = renderWithLoader();
    unmount();
    const release = loader.beginPending();
    expect(result.current).toBe(0);
    release();
  });

  it('answers zero outside a loader (error case)', () => {
    const { result } = renderHook(() => usePendingResourceCount());
    expect(result.current).toBe(0);
  });
});
