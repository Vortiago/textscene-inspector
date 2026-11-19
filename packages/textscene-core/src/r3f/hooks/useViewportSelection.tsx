/**
 * The canvas mesh picker: one set of delegated pointer handlers, for the single root group in
 * `NodeDispatcher`, that drive `<SelectionContext>` and tell the host (`HostSelection`). A pointer-up
 * selects only when travel stayed within `dragThresholdPx`, so a navigation drag does not select.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useSelection } from '../contexts/SelectionContext.js';
import { useCanvasWorkspace } from '../contexts/CanvasWorkspaceContext.js';
import { useHostPick } from '../hostSelection/HostSelection.js';
import { resolvePathFromObject } from './resolvePathFromObject.js';
import { getAncestorPaths } from '../../utils/nodePath.js';

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
  /** A click on nothing, which clears the selection in the 3D workspace (`node_3d_editor_plugin.cpp:998-1003`). */
  onPointerMissed?: () => void;
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
  // The 2D workspace picks no node yet (#1819), so the host hears of a click in the 3D one only.
  const isHostTold = useCanvasWorkspace() === '3d';

  const downPosRef = useRef<{ x: number; y: number } | null>(null);
  const expandedRef = useRef<ReadonlySet<string>>(expandedNodePaths);

  useEffect(() => {
    expandedRef.current = expandedNodePaths;
  }, [expandedNodePaths]);

  const select = useCallback(
    (nodePath: string) => {
      setSelectedNodePath(nodePath);
      if (autoExpandAncestors) {
        const ancestors = getAncestorPaths(nodePath);
        if (ancestors.length === 0) return;
        const current = expandedRef.current;
        const missing = ancestors.filter((a) => !current.has(a));
        if (missing.length > 0) {
          const next = new Set(current);
          for (const a of missing) next.add(a);
          setExpandedNodePaths(next);
        }
      }
    },
    [setSelectedNodePath, autoExpandAncestors, setExpandedNodePaths]
  );

  const pick = useCallback(
    (nodePath: string | null) => {
      if (isHostTold) host?.picked(nodePath);
      if (host?.ownsSelection) return;
      if (nodePath === null) setSelectedNodePath(null);
      else select(nodePath);
    },
    [host, isHostTold, select, setSelectedNodePath]
  );

  const handlers = useMemo<DelegatedPointerHandlers>(
    () => ({
      onPointerDown(e) {
        downPosRef.current = { x: e.clientX, y: e.clientY };
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
      onPointerMissed: isHostTold ? () => pick(null) : undefined,
    }),
    [dragThresholdPx, pick, hoverStore, objectPathMap, isHostTold]
  );

  return useMemo<UseViewportSelectionResult>(() => ({ handlers }), [handlers]);
}
