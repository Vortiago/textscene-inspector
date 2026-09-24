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

const CIRCLE_SEGMENTS = 32;
const CAPSULE_CAP_SEGMENTS = 16;

interface Point2D {
  x: number;
  y: number;
}

/** Godot-local (x, y) to three-local (x, -y), matching Sprite2D/Polygon2D's Y-negation. */
function toThreeLocal(points: Point2D[]): Float32Array {
  const out = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i++) {
    out[i * 3] = points[i]!.x;
    out[i * 3 + 1] = -points[i]!.y;
    out[i * 3 + 2] = 0;
  }
  return out;
}

/** Closed polygon vertices to line-segment pairs (v0,v1),(v1,v2),…,(vN-1,v0) for `<lineSegments>`. */
function loopToSegments(points: Point2D[]): Float32Array {
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

function rectanglePoints(size: { x: number; y: number }): Point2D[] {
  const hw = size.x / 2;
  const hh = size.y / 2;
  return [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
}

function circlePoints(radius: number): Point2D[] {
  const points: Point2D[] = [];
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const t = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    points.push({ x: radius * Math.cos(t), y: radius * Math.sin(t) });
  }
  return points;
}

/**
 * Vertical capsule: two semicircle caps joined by straight sides. Exported so a test can
 * assert the point sequence, which a rendered `<lineSegments>` buffer does not expose.
 */
export function capsulePoints(radius: number, height: number): Point2D[] {
  const halfHeight = Math.max(0, height / 2 - radius);
  const points: Point2D[] = [];

  // Right side, bottom to top.
  points.push({ x: radius, y: -halfHeight });
  points.push({ x: radius, y: halfHeight });

  // Top cap: 0°..180° around (0, halfHeight), from the right connection point over
  // the top to the left connection point.
  for (let i = 1; i < CAPSULE_CAP_SEGMENTS; i++) {
    const t = (i / CAPSULE_CAP_SEGMENTS) * Math.PI;
    points.push({ x: radius * Math.cos(t), y: halfHeight + radius * Math.sin(t) });
  }

  // Left side, top to bottom.
  points.push({ x: -radius, y: halfHeight });
  points.push({ x: -radius, y: -halfHeight });

  // Bottom cap: 180°..360° around (0, -halfHeight), from the left connection point
  // under the bottom back to the right connection point, closing the loop.
  for (let i = 1; i < CAPSULE_CAP_SEGMENTS; i++) {
    const t = Math.PI + (i / CAPSULE_CAP_SEGMENTS) * Math.PI;
    points.push({ x: radius * Math.cos(t), y: -halfHeight + radius * Math.sin(t) });
  }

  return points;
}

export function CollisionGizmo2D({
  shape,
  color,
}: {
  shape: TscnInternalResource;
  /** The node's `debug_color`, already resolved to a three colour. */
  color: THREE.Color;
}) {
  const data = shape.data as Record<string, string>;

  const points = useMemo((): Point2D[] => {
    switch (shape.type) {
      case 'RectangleShape2D':
        return rectanglePoints(decodeRectangleShape2D(data).size);
      case 'CircleShape2D':
        return circlePoints(decodeCircleShape2D(data).radius);
      case 'CapsuleShape2D': {
        const { radius, height } = decodeCapsuleShape2D(data);
        return capsulePoints(radius, height);
      }
      default:
        warn(`[CollisionShape2D] Unsupported shape type "${shape.type}" — drawing a unit rectangle.`);
        return rectanglePoints({ x: 20, y: 20 });
    }
  }, [shape.type, data]);

  const positions = useMemo(() => loopToSegments(points), [points]);

  // Polyline segments (`GizmoLine`, a `<lineSegments>`), not a `wireframe` mesh, which shows the
  // triangulation diagonals of a circle or capsule.
  return <GizmoLine positions={positions} color={color} />;
}
