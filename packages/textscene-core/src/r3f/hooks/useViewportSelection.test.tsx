import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
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

/**
 * A ThreeEvent-shaped mock. WI-213: event delegation resolves the node path
 * from `e.object` (the nearest raycasted mesh) via the reverse
 * `objectPathMap`, instead of a per-node `withNodePath(path)` handler
 * factory — so tests register a real Object3D at a path and put it on the
 * mock event, exactly like R3F would hand it to a single delegated root.
 */
function mockPointerEvent(
  x: number,
  y: number,
  object: THREE.Object3D | null = null
): {
  clientX: number;
  clientY: number;
  object: THREE.Object3D | null;
  stopPropagation: () => void;
} {
  return {
    clientX: x,
    clientY: y,
    object,
    stopPropagation: () => {},
  };
}

function setup() {
  return renderHook(
    () => ({ vp: useViewportSelection(), sel: useSelection() }),
    { wrapper: wrap }
  );
}

/** Registers a fresh Object3D at `path` and returns it for use in mock events. */
function registerObjectAt(sel: ReturnType<typeof useSelection>, path: string): THREE.Object3D {
  const object = new THREE.Object3D();
  act(() => sel.registerNodeObject(path, object));
  return object;
}

describe('useViewportSelection (WI-213: event-delegated)', () => {
  it('selects a node on a click (pointer-down then pointer-up at same position)', () => {
    const { result } = setup();
    const mesh = registerObjectAt(result.current.sel, 'Root/Mesh');

    act(() => {
      result.current.vp.handlers.onPointerDown(mockPointerEvent(100, 100, mesh) as never);
      result.current.vp.handlers.onPointerUp(mockPointerEvent(101, 102, mesh) as never);
    });

    expect(result.current.sel.selectedNodePath).toBe('Root/Mesh');
  });

  it('does NOT select when the pointer drags beyond the threshold (drag = no select)', () => {
    const { result } = renderHook(
      () => ({ vp: useViewportSelection({ dragThresholdPx: 5 }), sel: useSelection() }),
      { wrapper: wrap }
    );
    const mesh = registerObjectAt(result.current.sel, 'Root/Mesh');

    act(() => {
      result.current.vp.handlers.onPointerDown(mockPointerEvent(100, 100, mesh) as never);
      result.current.vp.handlers.onPointerUp(mockPointerEvent(200, 200, mesh) as never);
    });

    expect(result.current.sel.selectedNodePath).toBeNull();
  });

  it('does not select when the hit object resolves to no registered path (e.g. the empty-state grid)', () => {
    const { result } = setup();
    const unregistered = new THREE.Object3D();

    act(() => {
      result.current.vp.handlers.onPointerDown(mockPointerEvent(0, 0, unregistered) as never);
      result.current.vp.handlers.onPointerUp(mockPointerEvent(0, 0, unregistered) as never);
    });

    expect(result.current.sel.selectedNodePath).toBeNull();
  });

  it('a mesh nested under a node wrapper resolves to the node path by walking up the parent chain', () => {
    const { result } = setup();
    const wrapper = registerObjectAt(result.current.sel, 'Root/MeshInstance3D');
    const mesh = new THREE.Mesh();
    wrapper.add(mesh); // the actual hit geometry, one level below the registered wrapper

    act(() => {
      result.current.vp.handlers.onPointerDown(mockPointerEvent(0, 0, mesh) as never);
      result.current.vp.handlers.onPointerUp(mockPointerEvent(0, 0, mesh) as never);
    });

    expect(result.current.sel.selectedNodePath).toBe('Root/MeshInstance3D');
  });

  it('auto-expands ancestor paths in SelectionContext when selecting', () => {
    const { result } = setup();
    const mesh = registerObjectAt(result.current.sel, 'A/B/C');

    act(() => {
      result.current.vp.handlers.onPointerDown(mockPointerEvent(50, 50, mesh) as never);
      result.current.vp.handlers.onPointerUp(mockPointerEvent(50, 50, mesh) as never);
    });

    expect(result.current.sel.expandedNodePaths.has('A')).toBe(true);
    expect(result.current.sel.expandedNodePaths.has('A/B')).toBe(true);
    // The leaf itself is selected, not expanded (it's the destination, not an ancestor).
    expect(result.current.sel.expandedNodePaths.has('A/B/C')).toBe(false);
  });

  it('sets the hover store on pointer-move over a registered object and clears it on pointer-out', () => {
    const { result } = setup();
    const mesh = registerObjectAt(result.current.sel, 'Root');

    act(() => {
      result.current.vp.handlers.onPointerMove(mockPointerEvent(0, 0, mesh) as never);
    });
    expect(result.current.sel.hoverStore.get()).toBe('Root');

    act(() => {
      result.current.vp.handlers.onPointerOut(mockPointerEvent(0, 0, mesh) as never);
    });
    expect(result.current.sel.hoverStore.get()).toBeNull();
  });

  it('pointer-move over an unregistered object clears the hover store', () => {
    const { result } = setup();
    const mesh = registerObjectAt(result.current.sel, 'Root');
    const unregistered = new THREE.Object3D();

    act(() => {
      result.current.vp.handlers.onPointerMove(mockPointerEvent(0, 0, mesh) as never);
    });
    expect(result.current.sel.hoverStore.get()).toBe('Root');

    act(() => {
      result.current.vp.handlers.onPointerMove(mockPointerEvent(0, 0, unregistered) as never);
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
    const mesh = registerObjectAt(result.current.sel, 'A/B/C');

    act(() => {
      result.current.vp.handlers.onPointerDown(mockPointerEvent(0, 0, mesh) as never);
      result.current.vp.handlers.onPointerUp(mockPointerEvent(0, 0, mesh) as never);
    });

    expect(result.current.sel.selectedNodePath).toBe('A/B/C');
    expect(result.current.sel.expandedNodePaths.size).toBe(0);
  });

  it('returns the SAME handlers object across renders (one delegated root, not one per node)', () => {
    const { result, rerender } = setup();
    const first = result.current.vp.handlers;
    rerender();
    expect(result.current.vp.handlers).toBe(first);
  });
});
