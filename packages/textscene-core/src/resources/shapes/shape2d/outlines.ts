/**
 * The point loops of the 2D collision shapes that a gizmo fills and outlines, as Godot builds them.
 * Y grows downwards, as in Godot. The loop closes implicitly: the last point joins the first.
 */

import type { Vector2 } from '../../../godot/math/vector';
import { TAU } from '../../../godot/math/math';

/** `circle_shape_2d.cpp:80` and `capsule_shape_2d.cpp:25` both step the turn by `TAU / 24`. */
const TURN_STEPS = 24;
const TURN_STEP = TAU / TURN_STEPS;

/** The four corners of a centred `size` rectangle, clockwise from top-left (`rectangle_shape_2d.cpp:79-82`). */
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

/** A circle of `radius` about the origin, as 24 points (`circle_shape_2d.cpp:77-83`). */
export function circlePoints(radius: number): Vector2[] {
  return Array.from({ length: TURN_STEPS }, (_, i) => ({
    x: Math.cos(i * TURN_STEP) * radius,
    y: Math.sin(i * TURN_STEP) * radius,
  }));
}

/**
 * A vertical capsule, `CapsuleShape2D::_get_points` (`capsule_shape_2d.cpp:25-39`): 24 points on
 * the turn, with the arc centre moving to the other cap after the sixth and the eighteenth, which
 * each add the mirror point on the other centre.
 */
export function capsulePoints(radius: number, height: number): Vector2[] {
  const points: Vector2[] = [];
  for (let i = 0; i < TURN_STEPS; i++) {
    const offsetY = i > 6 && i <= 18 ? -height * 0.5 + radius : height * 0.5 - radius;
    const rim = { x: Math.sin(i * TURN_STEP) * radius, y: Math.cos(i * TURN_STEP) * radius };
    points.push({ x: rim.x, y: rim.y + offsetY });
    if (i === 6 || i === 18) points.push({ x: rim.x, y: rim.y - offsetY });
  }
  return points;
}
