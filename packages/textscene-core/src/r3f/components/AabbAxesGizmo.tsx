/**
 * A gizmo for a box with a centre mark: the 12 edges of an AABB and three unit axes from its
 * centre, in one Godot colour, and a faint fill that Godot adds only to a selected gizmo. The
 * caller gates it with `useGizmoState`.
 */

import { useMemo } from 'react';
import type { Aabb } from '../../godot/math/aabb';
import type { GizmoVariant } from '../gizmo/gizmoVariant';
import { useGodotLinearColor } from '../godotColor';
import { centreAxisLines } from '../gizmo/centreAxes';
import { AabbGizmo } from './AabbGizmo';
import { AabbSolidGizmo } from './AabbSolidGizmo';
import { GizmoLine } from './GizmoLine';

interface AabbAxesGizmoProps {
  aabb: Aabb;
  /** The sRGB colour Godot draws the edges and the axes in, and fills the box with. */
  color: { r: number; g: number; b: number };
  /** The opacity of the fill. */
  solidAlpha: number;
  variant: GizmoVariant;
}

export function AabbAxesGizmo({ aabb, color, solidAlpha, variant }: AabbAxesGizmoProps) {
  const axes = useMemo(() => new Float32Array(centreAxisLines(aabb)), [aabb]);
  return (
    <>
      <AabbGizmo aabb={aabb} color={color} variant={variant} />
      <GizmoLine positions={axes} color={useGodotLinearColor(color)} variant={variant} />
      {variant === 'selected' && <AabbSolidGizmo aabb={aabb} color={color} alpha={solidAlpha} />}
    </>
  );
}
