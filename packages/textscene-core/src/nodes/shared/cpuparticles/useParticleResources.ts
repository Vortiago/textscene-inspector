/** The curves and colour ramps an emitter's simulation reads, resolved and loaded as a hook. */

import { useCallback, useMemo } from 'react';
import type { Curve } from '../../../resources/curves/curve/types';
import type { Gradient } from '../../../resources/textures/gradienttexture2d/types';
import { useLoadedFiles } from '../../../resources/useLoadedFiles';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import type { ParticleParam } from './params';
import {
  paramCurveReferences,
  particleFiles,
  resolveParticleCurve,
  resolveParticleCurves,
  resolveParticleGradient,
} from './sceneResources';

/** The raw references an emitter names for its curves and ramps. */
export interface ParticleResourceReferences {
  params: readonly ParticleParam[];
  colorRamp: string | undefined;
  colorInitialRamp: string | undefined;
  /** CPUParticles3D's `scale_curve_x`, `_y` and `_z`, which only `split_scale` reads. */
  scaleCurves?: { x: string | undefined; y: string | undefined; z: string | undefined };
}

/** What the references resolve to, each null for none, a missing one, or a file still loading. */
export interface ParticleResources {
  /** One per parameter slot, indexed by `CPUParticlesParameter`. */
  curves: Array<Curve | null>;
  scaleCurves: { x: Curve | null; y: Curve | null; z: Curve | null };
  colorRamp: Gradient | null;
  colorInitialRamp: Gradient | null;
}

/** The resources `references` name in the scene, which re-resolve as each `.tres` loads. */
export function useParticleResources(references: ParticleResourceReferences): ParticleResources {
  const pools = useSceneResources();
  const { params, colorRamp, colorInitialRamp, scaleCurves } = references;
  const planFiles = useCallback(
    () =>
      particleFiles(
        [
          ...paramCurveReferences(params),
          colorRamp,
          colorInitialRamp,
          scaleCurves?.x,
          scaleCurves?.y,
          scaleCurves?.z,
        ],
        pools
      ),
    [params, colorRamp, colorInitialRamp, scaleCurves, pools]
  );
  const { loadedFile } = useLoadedFiles(planFiles);
  return useMemo(
    () => ({
      curves: resolveParticleCurves(params, pools, loadedFile),
      scaleCurves: {
        x: resolveParticleCurve(scaleCurves?.x, pools, loadedFile),
        y: resolveParticleCurve(scaleCurves?.y, pools, loadedFile),
        z: resolveParticleCurve(scaleCurves?.z, pools, loadedFile),
      },
      colorRamp: resolveParticleGradient(colorRamp, pools, loadedFile),
      colorInitialRamp: resolveParticleGradient(colorInitialRamp, pools, loadedFile),
    }),
    [params, colorRamp, colorInitialRamp, scaleCurves, pools, loadedFile]
  );
}
