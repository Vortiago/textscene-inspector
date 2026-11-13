/**
 * Whether the host shows the preview, and the render-loop rule that follows: both top-level
 * canvases read `usePreviewFrameloop`, so the rule is written once.
 */

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { useResourceLoader } from '../../resources/useResource.js';
import { textureWork } from '../../resources/textures/textureWork.js';
import { fontWork } from '../controls/native/text/settledChannel.js';

const NO_UNSUBSCRIBE = () => {};

/** The one default: a host with no visibility signal shows its preview, so every other embedder renders as before. */
const PreviewVisibilityContext = createContext(true);
PreviewVisibilityContext.displayName = 'PreviewVisibilityContext';

/** Without `isVisible`, the context keeps its default. */
export function PreviewVisibilityProvider({
  isVisible,
  children,
}: {
  isVisible?: boolean;
  children: ReactNode;
}) {
  if (isVisible === undefined) return children;
  return <PreviewVisibilityContext.Provider value={isVisible}>{children}</PreviewVisibilityContext.Provider>;
}

/**
 * R3F's `frameloop` for a top-level canvas. A hidden preview renders no frame, except while its
 * scene still loads: the tiled texture upload advances once per frame, so a loop that stopped first
 * would leave a scene hidden from the start never ready to capture.
 */
export function usePreviewFrameloop(): 'always' | 'never' {
  const isVisible = useContext(PreviewVisibilityContext);
  const loader = useResourceLoader();
  // A visible preview subscribes to nothing: its canvas would re-render on every count change
  // of a load, and rebuild its whole tree, for a `frameloop` that stays 'always'.
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (isVisible) return NO_UNSUBSCRIBE;
      const unsubscribes = [
        loader?.subscribePending(onChange),
        textureWork.subscribe(onChange),
        fontWork.subscribe(onChange),
      ];
      return () => unsubscribes.forEach((unsubscribe) => unsubscribe?.());
    },
    [isVisible, loader]
  );
  const isLoading = useSyncExternalStore(
    subscribe,
    () => !isVisible && (loader?.pendingResourceCount ?? 0) + textureWork.pending() + fontWork.pending() > 0
  );
  return isVisible || isLoading ? 'always' : 'never';
}
