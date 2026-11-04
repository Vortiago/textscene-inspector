/** The curves and colour ramps an emitter's simulation reads, resolved and loaded as a hook. */

import { useMemo } from 'react';
import type { Curve } from '../../../resources/curves/curve/types';
import type { Gradient } from '../../../resources/textures/gradienttexture2d/types';
import { useReferencedResources } from '../../../resources/useReferencedResources';
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

/** The `curve` reference of each parameter slot, always `CPU_PARTICLES_PARAM_COUNT` long. */
function paramCurveReferences(params: readonly ParticleParam[]): Array<string | undefined> {
  return Array.from({ length: CPU_PARTICLES_PARAM_COUNT }, (_, slot) => params[slot]?.curve);
}

/** The resources `references` name in the scene, which re-resolve as each `.tres` loads. */
export function useParticleResources(references: ParticleResourceReferences): ParticleResources {
  const { params, colorRamp, colorInitialRamp, scaleCurves } = references;
  const slotCount = CPU_PARTICLES_PARAM_COUNT;
  const { curves, gradients } = useReferencedResources(
    [...paramCurveReferences(params), scaleCurves?.x, scaleCurves?.y, scaleCurves?.z],
    [colorRamp, colorInitialRamp]
  );
  return useMemo(
    () => ({
      curves: curves.slice(0, slotCount),
      scaleCurves: { x: curves[slotCount]!, y: curves[slotCount + 1]!, z: curves[slotCount + 2]! },
      colorRamp: gradients[0]!,
      colorInitialRamp: gradients[1]!,
    }),
    [curves, gradients, slotCount]
  );
}
