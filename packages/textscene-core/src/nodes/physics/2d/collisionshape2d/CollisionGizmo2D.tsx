/**
 * Outline gizmo for the outline of a 2D collision shape, drawn as a line loop like Godot's editor
 * collision overlay. Component.tsx mounts it only when `showCollisions` is on.
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import { GizmoLine } from '../../../../r3f/components/GizmoLine';
import { godotPolylineToSegments } from '../../../../r3f/gizmo/godotPolylineToSegments';
import type { Vector2 } from '../../../../godot/math/vector';

/** `[x0, y0, x1, y1, …]`, the flat form of `PackedVector2Array`. */
function flatten(points: Vector2[]): Float32Array {
  const flat = new Float32Array(points.length * 2);
  points.forEach(({ x, y }, index) => flat.set([x, y], index * 2));
  return flat;
}

export function CollisionGizmo2D({
  outline,
  color,
}: {
  outline: Vector2[];
  /** The node's `debug_color`, already resolved to a three colour. */
  color: THREE.Color;
}) {
  const positions = useMemo(() => godotPolylineToSegments(flatten(outline), true), [outline]);

  // Polyline segments (`GizmoLine`, a `<lineSegments>`), not a `wireframe` mesh, which shows the
  // triangulation diagonals of a circle or capsule.
  return positions && <GizmoLine positions={positions} color={color} />;
}
