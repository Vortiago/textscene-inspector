import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useViewportSelection } from './useViewportSelection';
import { HierarchyProvider } from '../contexts/HierarchyContext';
import { SelectionProvider, useSelection } from '../contexts/SelectionContext';

function wrap({ children }: { children: ReactNode }) {
  return (
    <HierarchyProvider value={{ sceneGraph: null, panelId: 'p' }}>
      <SelectionProvider>{children}</SelectionProvider>
    </HierarchyProvider>
  );
}

function mockPointerEvent(x: number, y: number): {
  clientX: number;
  clientY: number;
  stopPropagation: () => void;
} {
  return {
    clientX: x,
    clientY: y,
    stopPropagation: () => {},
  };
}

describe('useViewportSelection', () => {
  it('selects a node on a click (pointer-down then pointer-up at same position)', () => {
    const { result } = renderHook(
      () => ({ vp: useViewportSelection(), sel: useSelection() }),
      { wrapper: wrap }
    );

    const handlers = result.current.vp.withNodePath('Root/Mesh');
    act(() => {
      handlers.onPointerDown(mockPointerEvent(100, 100) as never);
      handlers.onPointerUp(mockPointerEvent(101, 102) as never);
    });

    expect(result.current.sel.selectedNodePath).toBe('Root/Mesh');
  });

  it('does NOT select when the pointer drags beyond the threshold (drag = no select)', () => {
    const { result } = renderHook(
      () => ({ vp: useViewportSelection({ dragThresholdPx: 5 }), sel: useSelection() }),
      { wrapper: wrap }
    );

    const handlers = result.current.vp.withNodePath('Root/Mesh');
    act(() => {
      handlers.onPointerDown(mockPointerEvent(100, 100) as never);
      handlers.onPointerUp(mockPointerEvent(200, 200) as never);
    });

    expect(result.current.sel.selectedNodePath).toBeNull();
  });

  it('auto-expands ancestor paths in SelectionContext when selecting', () => {
    const { result } = renderHook(
      () => ({ vp: useViewportSelection(), sel: useSelection() }),
      { wrapper: wrap }
    );

    const handlers = result.current.vp.withNodePath('A/B/C');
    act(() => {
      handlers.onPointerDown(mockPointerEvent(50, 50) as never);
      handlers.onPointerUp(mockPointerEvent(50, 50) as never);
    });

    expect(result.current.sel.expandedNodePaths.has('A')).toBe(true);
    expect(result.current.sel.expandedNodePaths.has('A/B')).toBe(true);
    // The leaf itself is selected, not expanded (it's the destination, not an ancestor).
    expect(result.current.sel.expandedNodePaths.has('A/B/C')).toBe(false);
  });

  it('sets the hover store on pointer-over and clears it on pointer-out', () => {
    const { result } = renderHook(
      () => ({ vp: useViewportSelection(), sel: useSelection() }),
      { wrapper: wrap }
    );

    const handlers = result.current.vp.withNodePath('Root');
    act(() => {
      handlers.onPointerOver(mockPointerEvent(0, 0) as never);
    });
    expect(result.current.sel.hoverStore.get()).toBe('Root');

    act(() => {
      handlers.onPointerOut(mockPointerEvent(0, 0) as never);
    });
    expect(result.current.sel.hoverStore.get()).toBeNull();
  });

  it('respects autoExpandAncestors=false', () => {
    const { result } = renderHook(
      () => ({
        vp: useViewportSelection({ autoExpandAncestors: false }),
        sel: useSelection(),
      }),
      { wrapper: wrap }
    );

    const handlers = result.current.vp.withNodePath('A/B/C');
    act(() => {
      handlers.onPointerDown(mockPointerEvent(0, 0) as never);
      handlers.onPointerUp(mockPointerEvent(0, 0) as never);
    });

    expect(result.current.sel.selectedNodePath).toBe('A/B/C');
    expect(result.current.sel.expandedNodePaths.size).toBe(0);
  });
});
