/**
 * A selection-gated gizmo for a box with a centre mark: the 12 edges of an AABB, three unit axes
 * from its centre and a faint fill, all in one Godot colour. The caller gates it with
 * `useGizmoVisible`.
 */

import { useMemo } from 'react';
import type { Aabb } from '../../godot/math/aabb';
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
}

export function AabbAxesGizmo({ aabb, color, solidAlpha }: AabbAxesGizmoProps) {
  const axes = useMemo(() => new Float32Array(centreAxisLines(aabb)), [aabb]);
  return (
    <>
      <AabbGizmo aabb={aabb} color={color} />
      <GizmoLine positions={axes} color={useGodotLinearColor(color)} />
      <AabbSolidGizmo aabb={aabb} color={color} alpha={solidAlpha} />
    </>
  );
}
