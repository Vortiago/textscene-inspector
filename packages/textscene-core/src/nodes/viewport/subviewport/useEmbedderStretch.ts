import { useMemo } from 'react';
import { useViewportRect } from '../../../r3f/contexts/ViewportRectContext.js';
import { liveTreeOf } from '../../../r3f/liveSceneTree.js';
import { useSharedLiveTree } from '../../../r3f/useLiveSceneTree.js';
import { enclosingViewport, type EnclosingViewport } from './controlRasterViewports.js';
import { embedderStretch } from './targetSize.js';
import { useIsEditorHint } from '../../../r3f/contexts/EditorHintContext.js';
import { rootWindowStretch } from '../../../r3f/gameView/rootWindow.js';
import { useDrawnRootWindow, useProjectRootWindow } from '../../../r3f/gameView/useDrawnRootWindow.js';

/** The stretch `embedder` renders its windows at, or the root window's where no node stands for it. */
export function useEmbedderStretch(embedder: EnclosingViewport | null): number {
  const forced = useViewportRect(embedder?.path ?? null);
  const rootStretch = useRootWindowStretch();
  return embedder ? embedderStretch(embedder.node, forced) : rootStretch;
}

/** The editor draws its root window unstretched. The In-game view stretches it as its pane draws the root. */
function useRootWindowStretch(): number {
  const isEditorHint = useIsEditorHint();
  const drawnWindow = useDrawnRootWindow(useProjectRootWindow());
  return isEditorHint ? 1 : rootWindowStretch(drawnWindow);
}

/** The stretch the embedder of the window at `path` renders it at, found in the shared live tree. */
export function useEmbedderStretchAt(path: string): number {
  const live = useSharedLiveTree();
  const embedder = useMemo(
    () => (live ? enclosingViewport(liveTreeOf(live.roots, live.ctx), path) : null),
    [live, path]
  );
  return useEmbedderStretch(embedder);
}
