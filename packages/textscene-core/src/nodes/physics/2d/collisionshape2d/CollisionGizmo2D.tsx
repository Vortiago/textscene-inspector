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
import { warn } from '../../../../logger';
import type { Vector2 } from '../../../../godot/math/vector';
import { capsulePoints, circlePoints, rectanglePoints } from './collisionOutlines';

/** Godot-local (x, y) to three-local (x, -y), matching Sprite2D/Polygon2D's Y-negation. */
function toThreeLocal(points: Vector2[]): Float32Array {
  const out = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    out[i * 3] = points[i]!.x;
    out[i * 3 + 1] = -points[i]!.y;
    out[i * 3 + 2] = 0;
  }
  return out;
}

/** Closed polygon vertices to line-segment pairs (v0,v1),(v1,v2),…,(vN-1,v0) for `<lineSegments>`. */
function loopToSegments(points: Vector2[]): Float32Array {
  const vertices = toThreeLocal(points);
  const n = points.length;
  const out = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    out.set(vertices.subarray(i * 3, i * 3 + 3), i * 2 * 3);
    out.set(vertices.subarray(next * 3, next * 3 + 3), i * 2 * 3 + 3);
  }
  return out;
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

  const positions = useMemo(() => loopToSegments(points), [points]);

  // Polyline segments (`GizmoLine`, a `<lineSegments>`), not a `wireframe` mesh, which shows the
  // triangulation diagonals of a circle or capsule.
  return <GizmoLine positions={positions} color={color} />;
}
