/**
 * A Path2D's tessellated curve for its PathFollow2D descendants, whatever the
 * selection. A curveless Path2D provides `null`, so PathFollow2D keeps its
 * authored transform. The sampler gives Path2D-local pixels, +Y down, which
 * PathFollow2D conjugates (negated Y and rotation).
 */

import { createContext, useContext } from 'react';
import type { Curve2DSampler } from '../../resources/curves/curve2d';

const Path2DCurveContext = createContext<Curve2DSampler | null>(null);
Path2DCurveContext.displayName = 'Path2DCurveContext';

export const Path2DCurveProvider = Path2DCurveContext.Provider;

/** The nearest ancestor Path2D's curve sampler, or null when there is none. */
export function useParentPath2DCurve(): Curve2DSampler | null {
  return useContext(Path2DCurveContext);
}
