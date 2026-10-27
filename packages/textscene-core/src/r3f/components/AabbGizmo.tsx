/**
 * A gizmo that outlines a box: the 12 edges of an AABB in the colour a Godot gizmo plugin gives it.
 * The caller mounts it in a `PluginGizmo`.
 */

import { useMemo } from 'react';
import { aabbEdges, type Aabb } from '../../godot/math/aabb';
import { useGodotLinearColor } from '../godotColor';
import { GizmoLine } from './GizmoLine';

interface AabbGizmoProps {
  aabb: Aabb;
  /** The sRGB colour Godot draws the edges in. */
  color: { r: number; g: number; b: number };
}

export function AabbGizmo({ aabb, color }: AabbGizmoProps) {
  const positions = useMemo(() => new Float32Array(aabbEdges(aabb)), [aabb]);
  return <GizmoLine positions={positions} color={useGodotLinearColor(color)} />;
}
