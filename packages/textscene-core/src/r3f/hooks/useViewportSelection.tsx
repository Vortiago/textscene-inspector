/**
 * Canvas-side mesh picker. Returns R3F pointer-event handlers that drive
 * `<SelectionContext>` from the viewport. Replaces the imperative
 * `packages/textscene-core/src/ui/ViewportSelector.ts` mesh picker.
 *
 * Drag-vs-click discrimination keeps OrbitControls drags from selecting:
 * pointer-down records the position; pointer-up fires `setSelectedNodePath`
 * only if pointer travel stayed within `dragThresholdPx`.
 *
 * Node-component dispatchers attach the returned handlers to each
 * pickable object and call `withNodePath(path)` to scope them to the
 * mesh's node path. Final wiring of these into the canvas is WI-R3F-5.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useSelection } from '../contexts/SelectionContext.js';
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

export interface NodePathHandlers {
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOver: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (e: ThreeEvent<PointerEvent>) => void;
}

export interface UseViewportSelectionResult {
  /** Bind these handlers to a pickable object for the given node path. */
  withNodePath: (nodePath: string) => NodePathHandlers;
}

const DEFAULT_DRAG_THRESHOLD_PX = 5;

export function useViewportSelection(
  options: UseViewportSelectionOptions = {}
): UseViewportSelectionResult {
  const { dragThresholdPx = DEFAULT_DRAG_THRESHOLD_PX, autoExpandAncestors = true } = options;
  const {
    setSelectedNodePath,
    setHoveredNodePath,
    expandedNodePaths,
    setExpandedNodePaths,
  } = useSelection();

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

  const withNodePath = useCallback(
    (nodePath: string): NodePathHandlers => ({
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
        e.stopPropagation();
        select(nodePath);
      },
      onPointerOver(e) {
        e.stopPropagation();
        setHoveredNodePath(nodePath);
      },
      onPointerOut() {
        setHoveredNodePath(null);
      },
    }),
    [dragThresholdPx, select, setHoveredNodePath]
  );

  return useMemo<UseViewportSelectionResult>(() => ({ withNodePath }), [withNodePath]);
}
