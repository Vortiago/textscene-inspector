/**
 * Whether the host shows the preview, and the render-loop rule that follows: both top-level
 * canvases read `usePreviewFrameloop`, so the rule is written once.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { useSceneAssetsSettled } from '../useSceneAssetsSettled.js';

/** A host with no visibility signal shows its preview, so every other embedder renders as before. */
const PreviewVisibilityContext = createContext(true);
PreviewVisibilityContext.displayName = 'PreviewVisibilityContext';

export function PreviewVisibilityProvider({
  isVisible,
  children,
}: {
  isVisible: boolean;
  children: ReactNode;
}) {
  return <PreviewVisibilityContext.Provider value={isVisible}>{children}</PreviewVisibilityContext.Provider>;
}

/**
 * R3F's `frameloop` for a top-level canvas. A hidden preview renders no frame, except while its
 * scene still loads: the tiled texture upload advances once per frame, so a loop that stopped first
 * would leave a scene hidden from the start never ready to capture.
 */
export function usePreviewFrameloop(): 'always' | 'never' {
  const isVisible = useContext(PreviewVisibilityContext);
  const { isSettled } = useSceneAssetsSettled();
  return isVisible || !isSettled ? 'always' : 'never';
}
