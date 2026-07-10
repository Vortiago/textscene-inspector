import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
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
    expect(result.current.showCollisions).toBe(false);
  });

  it('defaults showGrid to false (#224 — must not invalidate visual baselines)', () => {
    const { result } = renderHook(() => useViewportMode(), { wrapper: wrapper() });
    expect(result.current.showGrid).toBe(false);
  });

  it('toggles showGrid', () => {
    const { result } = renderHook(() => useViewportMode(), { wrapper: wrapper() });
    act(() => result.current.setShowGrid(true));
    expect(result.current.showGrid).toBe(true);
  });

  it('honors initial values from the provider', () => {
    const { result } = renderHook(() => useViewportMode(), {
      wrapper: wrapper({ initialMode: '2D', initialShowCollisions: true }),
    });
    expect(result.current.mode).toBe('2D');
    expect(result.current.showCollisions).toBe(true);
  });

  it('toggles showCollisions', () => {
    const { result } = renderHook(() => useViewportMode(), { wrapper: wrapper() });
    expect(result.current.showCollisions).toBe(false);
    act(() => result.current.setShowCollisions(true));
    expect(result.current.showCollisions).toBe(true);
  });

  it('switches mode', () => {
    const { result } = renderHook(() => useViewportMode(), { wrapper: wrapper() });
    act(() => result.current.setMode('2D'));
    expect(result.current.mode).toBe('2D');
  });
});
