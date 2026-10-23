/**
 * A gizmo for a box with a centre mark: the 12 edges of an AABB and three unit axes from its
 * centre, in one Godot colour, and a faint fill that Godot adds only to a selected gizmo. The
 * caller mounts it in a `PluginGizmo`.
 */

import { useMemo } from 'react';
import type { Aabb } from '../../godot/math/aabb';
import { useGodotLinearColor } from '../godotColor';
import { centreAxisLines } from '../gizmo/centreAxes';
import { SelectedOnly } from '../gizmo/PluginGizmo';
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
      <SelectedOnly>
        <AabbSolidGizmo aabb={aabb} color={color} alpha={solidAlpha} />
      </SelectedOnly>
    </>
  );
}
