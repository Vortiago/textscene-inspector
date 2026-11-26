import { useCallback, useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useSelection } from '../contexts/SelectionContext.js';
import { useCanvasWorkspace } from '../contexts/CanvasWorkspaceContext.js';
import { useHostPick } from '../hostSelection/HostSelection.js';
import { resolvePathFromObject } from './resolvePathFromObject.js';

/** The pointer handlers of the viewport's click picking. */
export interface ViewportPointerHandlers {
  /** Bind to the canvas element, since R3F reports no press on nothing. */
  onCanvasPointerDown: (e: PointerEvent) => void;
  /** Bind to the canvas element. The browser sends it after the release a node picks on. */
  onCanvasClick: (e: MouseEvent) => void;
  /** Bind to the one root group wrapping the dispatched scene tree. */
  onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
}

export interface UseViewportSelectionResult {
  handlers: ViewportPointerHandlers;
}

/** Pixels of pointer travel up to which a press and release is a click (`node_3d_editor_plugin.cpp:2342`). */
const CLICK_TRAVEL_PX = 8;

interface Point {
  readonly clientX: number;
  readonly clientY: number;
}

const isClick = (press: Point, release: Point) =>
  Math.hypot(release.clientX - press.clientX, release.clientY - press.clientY) <= CLICK_TRAVEL_PX;

export function useViewportSelection(): UseViewportSelectionResult {
  const { setSelectedNodePath, objectPathMap } = useSelection();
  const host = useHostPick();
  // The 2D workspace picks no node yet, so a click on a sprite there would read as a click on nothing.
  const clearsOnNothing = useCanvasWorkspace() === '3d';

  /** Written by the canvas press, and cleared by the pick or the click that ends it. */
  const pressRef = useRef<Point | null>(null);
  const pick = useCallback(
    (nodePath: string | null) => {
      host.picked(nodePath);
      if (!host.ownsSelection) setSelectedNodePath(nodePath);
    },
    [host, setSelectedNodePath]
  );

  const handlers = useMemo<ViewportPointerHandlers>(
    () => ({
      onCanvasPointerDown(e) {
        // Only the left button selects (`node_3d_editor_plugin.cpp:1978`): the others orbit and look.
        pressRef.current = e.button === 0 ? { clientX: e.clientX, clientY: e.clientY } : null;
      },
      onPointerUp(e) {
        const press = pressRef.current;
        if (!press || !isClick(press, e)) return;
        const path = resolvePathFromObject(e.object, objectPathMap);
        if (!path) return;
        e.stopPropagation();
        pressRef.current = null;
        pick(path);
      },
      // A click on nothing is a region select of no size, which clears (node_3d_editor_plugin.cpp:998-1003).
      onCanvasClick(e) {
        const press = pressRef.current;
        pressRef.current = null;
        if (press && isClick(press, e) && clearsOnNothing) pick(null);
      },
    }),
    [pick, objectPathMap, clearsOnNothing]
  );

  return useMemo<UseViewportSelectionResult>(() => ({ handlers }), [handlers]);
}
