import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  SHOW_STORAGE_KEYS,
  ViewportModeProvider,
  useViewportMode,
  type ViewportModeProviderProps,
} from './ViewportModeContext';

function wrapper(props: Omit<ViewportModeProviderProps, 'children'> = {}) {
  return ({ children }: { children: ReactNode }) => (
    <ViewportModeProvider {...props}>{children}</ViewportModeProvider>
  );
}

describe('ViewportModeContext', () => {
  it('defaults to 3D with collisions hidden when no provider is mounted', () => {
    const { result } = renderHook(() => useViewportMode());
    expect(result.current.mode).toBe('3D');
    expect(result.current.show.collisions).toBe(false);
  });

  it('honours the initial mode and helpers', () => {
    const { result } = renderHook(() => useViewportMode(), {
      wrapper: wrapper({ initialMode: '2D', initialShow: { collisions: true } }),
    });
    expect(result.current.mode).toBe('2D');
    expect(result.current.show.collisions).toBe(true);
  });

  it('gives a helper the initial show leaves out its default', () => {
    const { result } = renderHook(() => useViewportMode(), {
      wrapper: wrapper({ initialShow: { collisions: true } }),
    });
    expect(result.current.show.gizmos).toBe(true);
  });

  it('changes only the helpers setShow is given', () => {
    const { result } = renderHook(() => useViewportMode(), {
      wrapper: wrapper({ initialShow: { fog: false } }),
    });
    act(() => result.current.setShow({ grid: true }));
    expect(result.current.show).toMatchObject({ grid: true, fog: false });
  });

  it('switches mode', () => {
    const { result } = renderHook(() => useViewportMode(), { wrapper: wrapper() });
    act(() => result.current.setMode('2D'));
    expect(result.current.mode).toBe('2D');
  });

  it('persists the helpers under the keys of earlier sessions', () => {
    expect(SHOW_STORAGE_KEYS).toEqual({
      gizmos: 'tsi.showGizmos',
      grid: 'tsi.showGrid',
      fog: 'tsi.showFog',
      performance: 'tsi.showPerformance',
    });
  });
});
