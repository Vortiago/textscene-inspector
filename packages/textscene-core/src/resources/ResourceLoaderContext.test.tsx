/**
 * ResourceLoaderContext and useResourceLoader. With no provider the hook returns
 * `null` and does not throw: `useResource` turns a null loader into an error status.
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import { useResourceLoader } from './useResource';
import { createFakeResourceLoader } from './testing/createFakeResourceLoader';

describe('ResourceLoaderContext', () => {
  it('useResourceLoader returns null outside a provider (does not throw)', () => {
    const { result } = renderHook(() => useResourceLoader());
    expect(result.current).toBeNull();
  });

  it('provider passes the loader instance through by identity', () => {
    const fake = createFakeResourceLoader();
    const { result } = renderHook(() => useResourceLoader(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
      ),
    });
    expect(result.current).toBe(fake.loader);
  });

  it('nested providers stack — the nearest loader wins for its subtree', () => {
    const outer = createFakeResourceLoader();
    const inner = createFakeResourceLoader();
    const { result } = renderHook(() => useResourceLoader(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ResourceLoaderProvider loader={outer.loader}>
          <ResourceLoaderProvider loader={inner.loader}>{children}</ResourceLoaderProvider>
        </ResourceLoaderProvider>
      ),
    });
    expect(result.current).toBe(inner.loader);
    expect(result.current).not.toBe(outer.loader);
  });
});
