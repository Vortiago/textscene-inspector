/**
 * The update mode a sub-viewport's pass renders by, and the viewport it sits in, read from the live
 * tree by the viewport's path and from the `visible` an AnimationPlayer drives on the nodes around
 * it. With no tree, the authored mode stands and the viewport is the root.
 */
import { useMemo } from 'react';

import { useAnimatedVisibility } from '../../../r3f/contexts/AnimatedValueContext.js';
import { useViewportRect } from '../../../r3f/contexts/ViewportRectContext.js';
import { liveTreeOf } from '../../../r3f/liveSceneTree.js';
import { useSharedLiveTree } from '../../../r3f/useLiveSceneTree.js';
import {
  resolveGate,
  ungatedViewport,
  viewportGateAt,
  type UpdateGate,
  type ViewportGate,
} from './viewportGate.js';

export function useViewportGate(path: string, authoredMode: number): UpdateGate {
  const live = useSharedLiveTree();
  const gate = useMemo(
    () =>
      live
        ? viewportGateAt(liveTreeOf(live.roots, live.ctx), path, authoredMode)
        : ungatedViewport(authoredMode),
    [live, path, authoredMode]
  );
  return useResolvedGate(gate, path);
}

/** `gate` with the animated `visible` and the stretched rect of the viewport at `path` laid over it. */
export function useResolvedGate(gate: ViewportGate, path: string): UpdateGate {
  const chainPaths = useMemo(() => gate.visibilityChain?.map((link) => link.path) ?? [], [gate]);
  const animated = useAnimatedVisibility(chainPaths);
  const hasStretchedRect = useViewportRect(path) !== null;
  const { updateMode, enclosingPath } = useMemo(
    () => resolveGate(gate, animated, hasStretchedRect),
    [gate, animated, hasStretchedRect]
  );
  // The primitives key the object, so a change that moves neither keeps the pass registered.
  return useMemo(() => ({ updateMode, enclosingPath }), [updateMode, enclosingPath]);
}
