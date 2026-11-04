/** The `gradient` and `width_curve` a Line2D names, resolved and loaded as a hook. */

import { useCallback, useMemo } from 'react';
import { resolveCurve } from '../../../resources/curves/curve/decode';
import type { Curve } from '../../../resources/curves/curve/types';
import { referencedFilePaths } from '../../../resources/resolveReference';
import { resolveGradient } from '../../../resources/textures/gradienttexture2d/decode';
import type { Gradient } from '../../../resources/textures/gradienttexture2d/types';
import { useLoadedFiles } from '../../../resources/useLoadedFiles';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';

/** What the references resolve to, each null for none, a missing one, or a file still loading. */
interface LineResources {
  gradient: Gradient | null;
  widthCurve: Curve | null;
}

/** The resources the references name in the scene, which re-resolve as each `.tres` loads. */
export function useLineResources(
  gradientRef: string | undefined,
  widthCurveRef: string | undefined
): LineResources {
  const pools = useSceneResources();
  const planFiles = useCallback(
    () => referencedFilePaths([gradientRef, widthCurveRef], pools),
    [gradientRef, widthCurveRef, pools]
  );
  const { loadedFile } = useLoadedFiles(planFiles);
  return useMemo(
    () => ({
      gradient: resolveGradient(gradientRef, pools, loadedFile),
      widthCurve: resolveCurve(widthCurveRef, pools, loadedFile),
    }),
    [gradientRef, widthCurveRef, pools, loadedFile]
  );
}
