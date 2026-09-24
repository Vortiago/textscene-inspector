/** The provider and hook of NodePathContext. NodeDispatcher.test.tsx covers the path joins. */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NodePathProvider, useNodePath } from './NodePathContext';

describe('NodePathContext', () => {
  it('returns null outside a provider (test-scaffolding fallback)', () => {
    const { result } = renderHook(() => useNodePath());
    expect(result.current).toBeNull();
  });

  it('returns the provided path inside a provider', () => {
    const { result } = renderHook(() => useNodePath(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NodePathProvider path="World/Hallway">{children}</NodePathProvider>
      ),
    });
    expect(result.current).toBe('World/Hallway');
  });

  it('nested providers stack — the inner (nearest) provider wins', () => {
    const { result } = renderHook(() => useNodePath(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NodePathProvider path="World">
          <NodePathProvider path="World/Hallway/Lamp">{children}</NodePathProvider>
        </NodePathProvider>
      ),
    });
    expect(result.current).toBe('World/Hallway/Lamp');
  });
});
