import { useCallback, useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useSelection } from '../contexts/SelectionContext.js';
import { useCanvasWorkspace } from '../contexts/CanvasWorkspaceContext.js';
import { useHostPick } from '../hostSelection/HostSelection.js';
import { resolvePathFromObject } from './resolvePathFromObject.js';

/** The pointer handlers for the viewport's single delegated root group. */
export interface DelegatedPointerHandlers {
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
  /** A miss, which on a click clears the selection in 3D (`node_3d_editor_plugin.cpp:998-1003`). */
  onPointerMissed?: (e: MouseEvent) => void;
}

export interface UseViewportSelectionResult {
  /** Bind these to the one root group wrapping the dispatched scene tree. */
  handlers: DelegatedPointerHandlers;
}

/** Pixels of pointer travel past which a click is a drag, which selects nothing. */
const DRAG_THRESHOLD_PX = 5;

export function useViewportSelection(): UseViewportSelectionResult {
  const { setSelectedNodePath, objectPathMap } = useSelection();
  const host = useHostPick();
  // The 2D workspace picks no node yet, so a click on a sprite there would read as a click on nothing.
  const takesMiss = useCanvasWorkspace() === '3d';

  const downPosRef = useRef<{ x: number; y: number } | null>(null);
  const pick = useCallback(
    (nodePath: string | null) => {
      host.picked(nodePath);
      if (!host.ownsSelection) setSelectedNodePath(nodePath);
    },
    [host, setSelectedNodePath]
  );

  const handlers = useMemo<DelegatedPointerHandlers>(
    () => ({
      onPointerDown(e) {
        // Only the left button selects (`node_3d_editor_plugin.cpp:1978`): the others orbit and look.
        downPosRef.current = e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
      },
      onPointerUp(e) {
        const down = downPosRef.current;
        downPosRef.current = null;
        if (!down) return;
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) return;
        const path = resolvePathFromObject(e.object, objectPathMap);
        if (!path) return;
        e.stopPropagation();
        pick(path);
      },
      // R3F also reports a miss for a right click, and for the release of a drag that starts on nothing.
      onPointerMissed: takesMiss
        ? (e) => {
            if (e.type === 'click') pick(null);
          }
        : undefined,
    }),
    [pick, objectPathMap, takesMiss]
  );

  return useMemo<UseViewportSelectionResult>(() => ({ handlers }), [handlers]);
}
