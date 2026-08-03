/**
 * Flows a Path3D's tessellated curve down to its PathFollow3D descendants — the
 * 3D twin of Path2DCurveContext.
 *
 * Path3D ALWAYS provides this (a sampler, or `null` when it has no Curve3D) so a
 * nested PathFollow3D can position its children along the nearest ancestor
 * path's curve, independent of selection (the gizmo is selection-gated, but the
 * follow placement is real scene state). A curveless Path3D provides `null`,
 * resetting any outer path for its subtree so PathFollow3D falls back to its
 * authored transform.
 */

import { createContext, useContext } from 'react';
import type { Curve3DSampler } from '../../resources/curves/curve3d';

const Path3DCurveContext = createContext<Curve3DSampler | null>(null);
Path3DCurveContext.displayName = 'Path3DCurveContext';

export const Path3DCurveProvider = Path3DCurveContext.Provider;

/** The nearest ancestor Path3D's curve sampler, or null when there is none. */
export function useParentPath3DCurve(): Curve3DSampler | null {
  return useContext(Path3DCurveContext);
}
