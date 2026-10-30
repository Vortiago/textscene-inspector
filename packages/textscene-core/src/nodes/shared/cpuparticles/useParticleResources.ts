/** The curves and colour ramps an emitter's simulation reads, resolved and loaded as a hook. */

import { useCallback, useMemo } from 'react';
import type { Curve } from '../../../resources/curves/curve/types';
import type { Gradient } from '../../../resources/textures/gradienttexture2d/types';
import { resolveGradient } from '../../../resources/textures/gradienttexture2d/decode';
import { useLoadedFiles } from '../../../resources/useLoadedFiles';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import type { ParticleParam } from './params';
import {
  paramCurveReferences,
  particleFiles,
  resolveParticleCurve,
  resolveParticleCurves,
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
  // Every named reference once, so the files to load and the resolve read one list.
  const named = useMemo(
    () => ({
      scaleX: scaleCurves?.x,
      scaleY: scaleCurves?.y,
      scaleZ: scaleCurves?.z,
      colorRamp,
      colorInitialRamp,
    }),
    [scaleCurves, colorRamp, colorInitialRamp]
  );
  const planFiles = useCallback(
    () => particleFiles([...paramCurveReferences(params), ...Object.values(named)], pools),
    [params, named, pools]
  );
  const { loadedFile } = useLoadedFiles(planFiles);
  return useMemo(() => {
    const curve = (reference: string | undefined) => resolveParticleCurve(reference, pools, loadedFile);
    const gradient = (reference: string | undefined) => resolveGradient(reference, pools, loadedFile);
    return {
      curves: resolveParticleCurves(params, pools, loadedFile),
      scaleCurves: { x: curve(named.scaleX), y: curve(named.scaleY), z: curve(named.scaleZ) },
      colorRamp: gradient(named.colorRamp),
      colorInitialRamp: gradient(named.colorInitialRamp),
    };
  }, [params, named, pools, loadedFile]);
}
