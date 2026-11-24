/**
 * Whether the host shows the preview, and the render-loop rule that follows: both top-level
 * canvases read `usePreviewFrameloop`, so the rule is written once.
 */

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { useResourceLoader } from '../../resources/useResource.js';
import { textureWork } from '../../resources/textures/textureWork.js';
import { fontWork } from '../controls/native/text/settledChannel.js';
import { hasPendingWork, pendingSceneWork } from '../sceneWork.js';
import { useViewStatusStore } from '../viewStatus/ViewStatusContext.js';
import type { ViewStatusStore } from '../viewStatus/viewStatus.js';

const NO_UNSUBSCRIBE = () => {};

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
  const loader = useResourceLoader();
  const view = useViewStatusStore();
  // A visible preview subscribes to nothing: its canvas would re-render on every count change
  // of a load, and rebuild its whole tree, for a `frameloop` that stays 'always'.
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (isVisible) return NO_UNSUBSCRIBE;
      const unsubscribes = [
        loader?.subscribePending(onChange),
        textureWork.subscribe(onChange),
        fontWork.subscribe(onChange),
        view?.subscribe(onChange),
      ];
      return () => unsubscribes.forEach((unsubscribe) => unsubscribe?.());
    },
    [isVisible, loader, view]
  );
  const isLoading = useSyncExternalStore(
    subscribe,
    () => !isVisible && (hasPendingWork(pendingSceneWork(loader)) || isViewWaiting(view))
  );
  return isVisible || isLoading ? 'always' : 'never';
}

function isViewWaiting(view: ViewStatusStore | null): boolean {
  return view !== null && (view.isPending() || view.isCapturePending());
}
