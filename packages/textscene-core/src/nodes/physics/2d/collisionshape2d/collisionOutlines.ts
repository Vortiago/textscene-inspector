/**
 * The outlines of the 2D collision shapes the gizmo draws, as closed loops of Godot-local points.
 * The loop closes implicitly: the last point joins the first.
 */

import type { Vector2 } from '../../../../godot/math/vector';
import { TAU } from '../../../../godot/math/math.js';

const CIRCLE_SEGMENTS = 32;
const CAPSULE_CAP_SEGMENTS = 16;

/** The four corners of a centred `size` rectangle, clockwise from top-left in Godot's +Y-down frame. */
export function rectanglePoints(size: Vector2): Vector2[] {
  const hw = size.x / 2;
  const hh = size.y / 2;
  return [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
}

/** A circle of `radius` about the origin, as a closed loop of `CIRCLE_SEGMENTS` points. */
export function circlePoints(radius: number): Vector2[] {
  const points: Vector2[] = [];
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const t = (i / CIRCLE_SEGMENTS) * TAU;
    points.push({ x: radius * Math.cos(t), y: radius * Math.sin(t) });
  }
  return points;
}

/** Vertical capsule: two semicircle caps joined by straight sides. */
export function capsulePoints(radius: number, height: number): Vector2[] {
  const halfHeight = Math.max(0, height / 2 - radius);
  const points: Vector2[] = [];

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
