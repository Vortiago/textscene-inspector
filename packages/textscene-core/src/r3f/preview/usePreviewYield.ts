import { useMemo } from 'react';
import { useViewShow } from '../viewShow/ViewShowContext';
import { useViewportDescription } from '../viewportRender/viewportDescriptionContext';
import { useLiveSceneNodes } from '../useLiveSceneTree';
import { YIELDS_A_PREVIEW, previewYield, type PreviewToggles } from './godotPreviewLighting';

export function usePreviewYield(): PreviewToggles {
  const { previewSun, previewEnvironment } = useViewShow();
  const previews = useViewportDescription().previewsEnvironment;
  const yielding = useLiveSceneNodes(YIELDS_A_PREVIEW);
  return useMemo(
    () =>
      previewYield(
        yielding.map((entry) => entry.node.type),
        { sun: previews && previewSun, environment: previews && previewEnvironment }
      ),
    [yielding, previews, previewSun, previewEnvironment]
  );
}
