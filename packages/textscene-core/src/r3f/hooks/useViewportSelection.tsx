/**
 * Canvas-side mesh picker. Returns ONE set of R3F pointer-event handlers
 * (WI-213: event-delegated) that drive `<SelectionContext>` from the
 * viewport — attach them to a single root group in `NodeDispatcher`, not to
 * every node. Replaces the imperative
 * `packages/textscene-core/src/ui/ViewportSelector.ts` mesh picker.
 *
 * Before WI-213 every node's wrapper `<group>` carried its own copy of these
 * handlers, bound to that node's path via a `withNodePath(path)` factory.
 * R3F treats every object with a registered pointer handler as its own
 * interactive raycast root, so a mesh at depth d got triangle-tested once
 * PER ANCESTOR wrapper on every pointer move (O(meshes × depth)). With one
 * delegated root, R3F raycasts the whole subtree exactly once per pointer
 * move; `resolvePathFromObject` recovers which node owns the hit mesh
 * (`e.object`) by walking its own THREE parent chain against the reverse
 * `objectPathMap` `<SelectionContext>` already builds — the CHILD node's
 * wrapper sits closer to the hit mesh than any ancestor's, so this
 * reproduces the historical "innermost node wins" behavior without R3F
 * bubbling.
 *
 * Drag-vs-click discrimination keeps OrbitControls drags from selecting:
 * pointer-down records the position; pointer-up fires `setSelectedNodePath`
 * only if pointer travel stayed within `dragThresholdPx`.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useSelection } from '../contexts/SelectionContext.js';
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

/** The ONE set of pointer handlers attached to the viewport's single delegated root group. */
export interface DelegatedPointerHandlers {
  onPointerDown: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp: (e: ThreeEvent<PointerEvent>) => void;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: (e: ThreeEvent<PointerEvent>) => void;
}

export interface UseViewportSelectionResult {
  /** Bind these to the SINGLE root group wrapping the dispatched scene tree. */
  handlers: DelegatedPointerHandlers;
}

const DEFAULT_DRAG_THRESHOLD_PX = 5;

export function useViewportSelection(
  options: UseViewportSelectionOptions = {}
): UseViewportSelectionResult {
  const { dragThresholdPx = DEFAULT_DRAG_THRESHOLD_PX, autoExpandAncestors = true } = options;
  const {
    setSelectedNodePath,
    hoverStore,
    expandedNodePaths,
    setExpandedNodePaths,
    objectPathMap,
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
        select(path);
      },
      // Hover tracks whichever registered node is nearest under the pointer
      // as it moves across the (single, delegated) interactive root —
      // onPointerOver/onPointerOut fire once for the WHOLE root, not per
      // descendant, so onPointerMove is what carries the per-mesh `e.object`.
      onPointerMove(e) {
        const path = resolvePathFromObject(e.object, objectPathMap);
        hoverStore.set(path);
      },
      onPointerOut() {
        hoverStore.set(null);
      },
    }),
    [dragThresholdPx, select, hoverStore, objectPathMap]
  );

  return useMemo<UseViewportSelectionResult>(() => ({ handlers }), [handlers]);
}
