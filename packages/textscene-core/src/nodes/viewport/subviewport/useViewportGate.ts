/**
 * The update mode a sub-viewport's pass renders by, and the viewport it sits in, read from the live
 * tree by the viewport's path. With no tree, the authored mode stands and the viewport is the root.
 */
import { useMemo } from 'react';

import { liveTreeOf } from '../../../r3f/liveSceneTree.js';
import { useSharedLiveTree } from '../../../r3f/useLiveSceneTree.js';
import { viewportGateAt, type ViewportGate } from './viewportGate.js';

export function useViewportGate(path: string, authoredMode: number): ViewportGate {
  const live = useSharedLiveTree();
  const { updateMode, enclosingPath } = useMemo(
    () =>
      live
        ? viewportGateAt(liveTreeOf(live.roots, live.ctx), path, authoredMode)
        : { updateMode: authoredMode, enclosingPath: null },
    [live, path, authoredMode]
  );
  // The primitives key the object, so a tree change that moves neither keeps the pass registered.
  return useMemo(() => ({ updateMode, enclosingPath }), [updateMode, enclosingPath]);
}
