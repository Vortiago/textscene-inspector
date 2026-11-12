/** The curves and colour ramps an emitter's simulation reads, read as a hook. */

import { useCallback } from 'react';
import { CURVE } from '../../../resources/curves/curve';
import type { Curve } from '../../../resources/curves/curve/types';
import { useSnapshotRead } from '../../../resources/reading';
import { GRADIENT } from '../../../resources/textures/gradienttexture2d';
import type { Gradient } from '../../../resources/textures/gradienttexture2d/types';
import { CPU_PARTICLES_PARAM_COUNT, type ParticleParam } from './params';

/** The raw references an emitter names for its curves and ramps. */
export interface ParticleResourceReferences {
  params: readonly ParticleParam[];
  colorRamp: string | undefined;
  colorInitialRamp: string | undefined;
  /** The `scale_curve_x`, `_y` and `_z` of CPUParticles, which only `split_scale` reads. 2D has no z. */
  scaleCurves?: { x: string | undefined; y: string | undefined; z?: string | undefined };
}

/** What the references resolve to, each null for none, a missing one, or a file still loading. */
export interface ParticleResources {
  /** One per parameter slot, indexed by `CPUParticlesParameter`. */
  curves: Array<Curve | null>;
  scaleCurves: { x: Curve | null; y: Curve | null; z: Curve | null };
  colorRamp: Gradient | null;
  colorInitialRamp: Gradient | null;
}

/** The resources `references` name in the scene, which read again as each `.tres` loads. */
export function useParticleResources(references: ParticleResourceReferences): ParticleResources {
  const { params, colorRamp, colorInitialRamp } = references;
  // The strings, not the `scaleCurves` object: a caller builds that object on each render.
  const scaleX = references.scaleCurves?.x;
  const scaleY = references.scaleCurves?.y;
  const scaleZ = references.scaleCurves?.z;
  return useSnapshotRead(
    useCallback(
      (read) => ({
        curves: Array.from(
          { length: CPU_PARTICLES_PARAM_COUNT },
          (_, slot) => read(params[slot]?.curve, CURVE).value
        ),
        scaleCurves: {
          x: read(scaleX, CURVE).value,
          y: read(scaleY, CURVE).value,
          z: read(scaleZ, CURVE).value,
        },
        colorRamp: read(colorRamp, GRADIENT).value,
        colorInitialRamp: read(colorInitialRamp, GRADIENT).value,
      }),
      [params, scaleX, scaleY, scaleZ, colorRamp, colorInitialRamp]
    )
  );
}
