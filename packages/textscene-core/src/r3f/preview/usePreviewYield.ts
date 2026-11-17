import { useMemo } from 'react';
import { useViewportMode } from '../contexts/ViewportModeContext';
import { useViewportDescription } from '../viewportRender/viewportDescriptionContext';
import { useLiveSceneNodes } from '../useLiveSceneTree';
import { YIELDS_A_PREVIEW, previewYield, type PreviewToggles } from './godotPreviewLighting';

export function usePreviewYield(): PreviewToggles {
  const { showPreviewSun, showPreviewEnvironment } = useViewportMode();
  const previews = useViewportDescription().previewsEnvironment;
  const yielding = useLiveSceneNodes(YIELDS_A_PREVIEW);
  return useMemo(
    () =>
      previewYield(
        yielding.map((entry) => entry.node.type),
        { sun: previews && showPreviewSun, environment: previews && showPreviewEnvironment }
      ),
    [yielding, previews, showPreviewSun, showPreviewEnvironment]
  );
}
