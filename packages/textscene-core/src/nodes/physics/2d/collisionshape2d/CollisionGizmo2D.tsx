/**
 * Outline gizmo for a 2D collision-shape resource, drawn as a line loop like Godot's editor
 * collision overlay. Component.tsx mounts it only when `showCollisions` is on.
 */

import { useMemo } from 'react';
import type { TscnInternalResource } from '../../../../parser/types';
import { decodeRectangleShape2D } from '../../../../resources/shapes/rectangleshape2d';
import { decodeCircleShape2D } from '../../../../resources/shapes/circleshape2d';
import { decodeCapsuleShape2D } from '../../../../resources/shapes/capsuleshape2d';
import type * as THREE from 'three';
import { GizmoLine } from '../../../../r3f/components/GizmoLine';
import { godotPolylineToSegments } from '../../../../r3f/gizmo/godotPolylineToSegments';
import { warn } from '../../../../logger';
import type { Vector2 } from '../../../../godot/math/vector';
import { capsulePoints, circlePoints, rectanglePoints } from './collisionOutlines';

/** `[x0, y0, x1, y1, …]`, the flat form of `PackedVector2Array`. */
function flatten(points: Vector2[]): Float32Array {
  const flat = new Float32Array(points.length * 2);
  points.forEach(({ x, y }, index) => flat.set([x, y], index * 2));
  return flat;
}

export function CollisionGizmo2D({
  shape,
  color,
}: {
  shape: TscnInternalResource;
  /** The node's `debug_color`, already resolved to a three colour. */
  color: THREE.Color;
}) {
  const points = useMemo((): Vector2[] => {
    switch (shape.type) {
      case 'RectangleShape2D':
        return rectanglePoints(decodeRectangleShape2D(shape.data).size);
      case 'CircleShape2D':
        return circlePoints(decodeCircleShape2D(shape.data).radius);
      case 'CapsuleShape2D': {
        const { radius, height } = decodeCapsuleShape2D(shape.data);
        return capsulePoints(radius, height);
      }
      default:
        warn(`[CollisionShape2D] Unsupported shape type "${shape.type}" — drawing a unit rectangle.`);
        return rectanglePoints({ x: 20, y: 20 });
    }
  }, [shape.type, shape.data]);

  const positions = useMemo(() => godotPolylineToSegments(flatten(points), true), [points]);

  // Polyline segments (`GizmoLine`, a `<lineSegments>`), not a `wireframe` mesh, which shows the
  // triangulation diagonals of a circle or capsule.
  return positions && <GizmoLine positions={positions} color={color} />;
}
