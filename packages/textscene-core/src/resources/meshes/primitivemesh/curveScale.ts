/** The Curve a trail mesh scales its width by, shared by the TubeTrailMesh and RibbonTrailMesh builders. */

import { bakedCurveSampler } from '../../curves/curve/bakedSample.js';
import type { Curve } from '../../curves/curve/types.js';

/** `Curve::sample_baked` at an offset, or 1 along the whole mesh for no curve or a curve with no point. */
export function curveScaleSampler(curve: Curve | null): (offset: number) => number {
  return curve && curve.points.length > 0 ? bakedCurveSampler(curve) : () => 1;
}
