/**
 * Whether the host shows the preview, and the render-loop rule that follows: both top-level
 * canvases read `usePreviewFrameloop`, so the rule is written once.
 */

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { useViewWork } from '../../resources/ResourceLoaderContext.js';
import { isViewWorking, subscribeSceneWork } from '../sceneWork.js';
import { subscribeToNothing } from '../../utils/subscribeToNothing.js';
import { useViewStatusStore } from '../viewStatus/ViewStatusContext.js';
import type { ViewStatusStore } from '../viewStatus/viewStatus.js';

/** The one default: a host with no visibility signal shows its preview, so every other embedder renders as before. */
const PreviewVisibilityContext = createContext(true);
PreviewVisibilityContext.displayName = 'PreviewVisibilityContext';

/** One provider either way, so a change to or from no value keeps the canvas below mounted. */
export function PreviewVisibilityProvider({
  isVisible,
  children,
}: {
  isVisible?: boolean;
  children: ReactNode;
}) {
  const inherited = useContext(PreviewVisibilityContext);
  return (
    <PreviewVisibilityContext.Provider value={isVisible ?? inherited}>
      {children}
    </PreviewVisibilityContext.Provider>
  );
}

/** A hidden preview draws while its scene loads or owes a capture: each advances only in a frame. */
export function usePreviewFrameloop(): 'always' | 'never' {
  const isVisible = useContext(PreviewVisibilityContext);
  const work = useViewWork();
  const view = useViewStatusStore();
  // A visible preview subscribes to nothing: its canvas would re-render on every count change
  // of a load, and rebuild its whole tree, for a `frameloop` that stays 'always'.
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (isVisible) return subscribeToNothing();
      const unsubscribes = [subscribeSceneWork(work, onChange), view?.subscribe(onChange)];
      return () => unsubscribes.forEach((unsubscribe) => unsubscribe?.());
    },
    [isVisible, work, view]
  );
  const isLoading = useSyncExternalStore(
    subscribe,
    () => !isVisible && (isViewWorking(work) || isViewWaiting(view))
  );
  return isVisible || isLoading ? 'always' : 'never';
}

function isViewWaiting(view: ViewStatusStore | null): boolean {
  return view !== null && (view.isPending() || view.isCapturePending());
}
