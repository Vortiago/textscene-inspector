import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useSelection } from '../contexts/SelectionContext.js';
import { useCanvasWorkspace } from '../contexts/CanvasWorkspaceContext.js';
import { useHostPick } from '../hostSelection/HostSelection.js';
import { resolvePathFromObject } from './resolvePathFromObject.js';
import { withAncestorsExpanded } from '../../utils/nodePath.js';

export interface UseViewportSelectionOptions {
  /** Pixels of pointer travel before a click is treated as a drag. Defaults to 5. */
  dragThresholdPx?: number;
  /**
   * If true, auto-expand the selected node's ancestors in the tree.
   * Defaults to true so canvas-driven selection reveals the row.
   */
  autoExpandAncestors?: boolean;
}

/** The pointer handlers for the viewport's single delegated root group. */
export interface DelegatedPointerHandlers {
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (e: ThreeEvent<PointerEvent>) => void;
  /** A miss, which on a click clears the selection in 3D (`node_3d_editor_plugin.cpp:998-1003`). */
  onPointerMissed?: (e: MouseEvent) => void;
}

export interface UseViewportSelectionResult {
  /** Bind these to the one root group wrapping the dispatched scene tree. */
  handlers: DelegatedPointerHandlers;
}

const DEFAULT_DRAG_THRESHOLD_PX = 5;

export function useViewportSelection(options: UseViewportSelectionOptions = {}): UseViewportSelectionResult {
  const { dragThresholdPx = DEFAULT_DRAG_THRESHOLD_PX, autoExpandAncestors = true } = options;
  const { setSelectedNodePath, hoverStore, expandedNodePaths, setExpandedNodePaths, objectPathMap } =
    useSelection();
  const host = useHostPick();
  // The 2D workspace picks no node yet, so a click on a sprite there would read as a click on nothing.
  const takesMiss = useCanvasWorkspace() === '3d';

  const downPosRef = useRef<{ x: number; y: number } | null>(null);
  const expandedRef = useRef<ReadonlySet<string>>(expandedNodePaths);

  useEffect(() => {
    expandedRef.current = expandedNodePaths;
  }, [expandedNodePaths]);

  const select = useCallback(
    (nodePath: string) => {
      setSelectedNodePath(nodePath);
      if (!autoExpandAncestors) return;
      const expanded = withAncestorsExpanded(expandedRef.current, nodePath);
      if (expanded !== expandedRef.current) setExpandedNodePaths(expanded);
    },
    [setSelectedNodePath, autoExpandAncestors, setExpandedNodePaths]
  );

  const pick = useCallback(
    (nodePath: string | null) => {
      host.picked(nodePath);
      if (host.ownsSelection) return;
      if (nodePath === null) setSelectedNodePath(null);
      else select(nodePath);
    },
    [host, select, setSelectedNodePath]
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
        if (Math.hypot(dx, dy) > dragThresholdPx) return;
        const path = resolvePathFromObject(e.object, objectPathMap);
        if (!path) return;
        e.stopPropagation();
        pick(path);
      },
      // Over and out fire once for the whole root, so move carries the per-mesh `e.object`. R3F
      // calls it per intersected mesh, nearest first, until `stopPropagation()`: without the stop
      // the farthest mesh wins. Stopping only on a resolved path lets an unregistered nearest hit,
      // such as the grid, fall through to a registered mesh behind it.
      onPointerMove(e) {
        const path = resolvePathFromObject(e.object, objectPathMap);
        hoverStore.set(path);
        if (path) e.stopPropagation();
      },
      onPointerOut() {
        hoverStore.set(null);
      },
      // R3F also reports a miss for a right click, and for the release of a drag that starts on nothing.
      onPointerMissed: takesMiss
        ? (e) => {
            if (e.type === 'click') pick(null);
          }
        : undefined,
    }),
    [dragThresholdPx, pick, hoverStore, objectPathMap, takesMiss]
  );

  return useMemo<UseViewportSelectionResult>(() => ({ handlers }), [handlers]);
}
