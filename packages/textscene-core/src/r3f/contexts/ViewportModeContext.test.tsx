import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  SHOW_GIZMOS_STORAGE_KEY,
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

  it('defaults showPerformance to false, so no frame is profiled unasked', () => {
    const { result } = renderHook(() => useViewportMode(), { wrapper: wrapper() });
    expect(result.current.showPerformance).toBe(false);
  });

  it('toggles showPerformance', () => {
    const { result } = renderHook(() => useViewportMode(), { wrapper: wrapper() });
    act(() => result.current.setShowPerformance(true));
    expect(result.current.showPerformance).toBe(true);
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

  it('shows the fog by default, as Godot draws it', () => {
    const { result } = renderHook(() => useViewportMode(), { wrapper: wrapper() });
    expect(result.current.showFog).toBe(true);
  });

  it('hides and shows the fog', () => {
    const { result } = renderHook(() => useViewportMode(), { wrapper: wrapper({ initialShowFog: false }) });
    expect(result.current.showFog).toBe(false);
    act(() => result.current.setShowFog(true));
    expect(result.current.showFog).toBe(true);
  });

  it('shows the gizmos by default, as the Godot editor does (View Gizmos)', () => {
    const { result } = renderHook(() => useViewportMode(), { wrapper: wrapper() });
    expect(result.current.showGizmos).toBe(true);
  });

  it('shows the gizmos with no provider mounted', () => {
    const { result } = renderHook(() => useViewportMode());
    expect(result.current.showGizmos).toBe(true);
  });

  it('hides and shows the gizmos', () => {
    const { result } = renderHook(() => useViewportMode(), {
      wrapper: wrapper({ initialShowGizmos: false }),
    });
    expect(result.current.showGizmos).toBe(false);
    act(() => result.current.setShowGizmos(true));
    expect(result.current.showGizmos).toBe(true);
  });

  it('persists the gizmos under tsi.showGizmos', () => {
    expect(SHOW_GIZMOS_STORAGE_KEY).toBe('tsi.showGizmos');
  });

  it('switches mode', () => {
    const { result } = renderHook(() => useViewportMode(), { wrapper: wrapper() });
    act(() => result.current.setMode('2D'));
    expect(result.current.mode).toBe('2D');
  });
});
