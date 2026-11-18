import { useMemo } from 'react';
import { useViewportRect } from '../../../r3f/contexts/ViewportRectContext.js';
import { liveTreeOf } from '../../../r3f/liveSceneTree.js';
import { useSharedLiveTree } from '../../../r3f/useLiveSceneTree.js';
import { embedsSubwindows } from '../../../r3f/viewportRender/windowEmbedder.js';
import { enclosingViewport, type EnclosingViewport } from './controlRasterViewports.js';
import { embedderStretch } from './targetSize.js';
import { useIsEditorHint } from '../../../r3f/contexts/EditorHintContext.js';
import { rootWindowStretch } from '../../../r3f/gameView/rootWindow.js';
import { useDrawnRootWindow, useProjectRootWindow } from '../../../r3f/gameView/useDrawnRootWindow.js';

/** A native window has no embedder, so it renders unstretched (`window.cpp:1362`). */
const NATIVE_STRETCH = 1;

/** The stretch `embedder` renders its windows at. Null is a native window. */
export function useEmbedderStretch(embedder: EnclosingViewport | null): number {
  const forced = useViewportRect(embedder?.path ?? null);
  return embedder ? embedderStretch(embedder.node, forced) : NATIVE_STRETCH;
}

/** What embeds a window in the shared live tree: a viewport node, or the root it holds no node for. */
interface WindowEmbedder {
  viewport: EnclosingViewport | null;
  isRootEmbedder: boolean;
}

/** The stretch the embedder of the window at `path` renders it at. Null `path` reads no stretch. */
export function useEmbedderStretchAt(path: string | null): number {
  const live = useSharedLiveTree();
  const embedder = useMemo((): WindowEmbedder | null => {
    if (!live || path === null) return null;
    const tree = liveTreeOf(live.roots, live.ctx);
    const viewport = enclosingViewport(tree, path);
    return { viewport, isRootEmbedder: viewport === null && embedsSubwindows(tree, null) };
  }, [live, path]);
  const viewportStretch = useEmbedderStretch(embedder?.viewport ?? null);
  const rootStretch = useRootWindowStretch();
  return embedder?.isRootEmbedder ? rootStretch : viewportStretch;
}

/** The editor draws its root window unstretched. The In-game view stretches it as its pane draws the root. */
function useRootWindowStretch(): number {
  const isEditorHint = useIsEditorHint();
  const drawnWindow = useDrawnRootWindow(useProjectRootWindow());
  return isEditorHint ? 1 : rootWindowStretch(drawnWindow);
}
