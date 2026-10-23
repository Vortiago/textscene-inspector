/**
 * A gizmo that outlines a box: the 12 edges of an AABB in the colour a Godot gizmo plugin gives it.
 * The caller gates it with `useGizmoState`.
 */

import { useMemo } from 'react';
import { aabbEdges, type Aabb } from '../../godot/math/aabb';
import { useGodotLinearColor } from '../godotColor';
import type { GizmoVariant } from '../gizmo/gizmoVariant';
import { GizmoLine } from './GizmoLine';

interface AabbGizmoProps {
  aabb: Aabb;
  /** The sRGB colour Godot draws the edges in. */
  color: { r: number; g: number; b: number };
  variant: GizmoVariant;
}

export function AabbGizmo({ aabb, color, variant }: AabbGizmoProps) {
  const positions = useMemo(() => new Float32Array(aabbEdges(aabb)), [aabb]);
  return <GizmoLine positions={positions} color={useGodotLinearColor(color)} variant={variant} />;
}
