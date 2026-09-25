/**
 * A Path3D's tessellated curve for its PathFollow3D descendants, whatever the
 * selection. A curveless Path3D provides `null`, so PathFollow3D keeps its
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
