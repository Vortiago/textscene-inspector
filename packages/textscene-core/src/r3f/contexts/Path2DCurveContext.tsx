/**
 * Flows a Path2D's tessellated curve down to its PathFollow2D descendants.
 *
 * Path2D ALWAYS provides this (a sampler, or `null` when it has no Curve2D) so a
 * nested PathFollow2D can position its children along the nearest ancestor
 * path's curve — independent of selection (the visual gizmo is selection-gated,
 * but the follow placement is real scene state). A curveless Path2D provides
 * `null`, which correctly resets any outer path for its subtree: PathFollow2D
 * then falls back to its authored transform (matching PathFollow3D / ADR-0008).
 *
 * The sampler's coordinates are Path2D-local Godot pixels (+Y down); PathFollow2D
 * conjugates them (negate Y, negate rotation) when it builds its group transform.
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
