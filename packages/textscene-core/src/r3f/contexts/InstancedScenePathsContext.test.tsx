/** The provider and hook of InstancedScenePathsContext. NodeDispatcher.cyclicInstancing.test.tsx covers its use. */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { InstancedScenePathsProvider, useInstancedScenePaths } from './InstancedScenePathsContext';

describe('InstancedScenePathsContext', () => {
  it('returns an empty list outside a provider', () => {
    const { result } = renderHook(() => useInstancedScenePaths());
    expect(result.current).toEqual([]);
  });

  it('returns the provided paths inside a provider', () => {
    const paths = ['res://a.tscn'];
    const { result } = renderHook(() => useInstancedScenePaths(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <InstancedScenePathsProvider paths={paths}>{children}</InstancedScenePathsProvider>
      ),
    });
    expect(result.current).toBe(paths);
  });

  it('lets the nearest provider win, so a grafted node can restore its own chain', () => {
    const { result } = renderHook(() => useInstancedScenePaths(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <InstancedScenePathsProvider paths={['res://a.tscn', 'res://b.tscn']}>
          <InstancedScenePathsProvider paths={[]}>{children}</InstancedScenePathsProvider>
        </InstancedScenePathsProvider>
      ),
    });
    expect(result.current).toEqual([]);
  });
});
