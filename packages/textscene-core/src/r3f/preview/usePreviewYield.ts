/** Which editor previews the live scene leaves in place, under the user's toolbar toggles (ADR-0025). */

import { useMemo } from 'react';
import { useViewportMode } from '../contexts/ViewportModeContext';
import { useLiveSceneNodes } from '../useLiveSceneTree';
import { YIELDS_A_PREVIEW, previewYield, type PreviewToggles } from './godotPreviewLighting';

export function usePreviewYield(): PreviewToggles {
  const { showPreviewSun, showPreviewEnvironment } = useViewportMode();
  const yielding = useLiveSceneNodes(YIELDS_A_PREVIEW);
  return useMemo(
    () =>
      previewYield(
        yielding.map((entry) => entry.node.type),
        { sun: showPreviewSun, environment: showPreviewEnvironment }
      ),
    [yielding, showPreviewSun, showPreviewEnvironment]
  );
}
