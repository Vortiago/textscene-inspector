/**
 * The occluder edges a 2D light's shadow map is built from, and the two tests Godot applies to
 * them: which edges cast under `cull_mode`, and which occluders the light's rect keeps. Everything
 * is in the previewer's 2D world space, Y up.
 */

import type { EnumValue } from '../../godot/classdb/enumNames.js';
import type { Vector2 } from '../../godot/math/vector.js';
import { OccluderPolygon2DCullMode } from '../../godot/scene/lightOccluder2d.js';

export type OccluderCullMode = EnumValue<typeof OccluderPolygon2DCullMode>;

/** An axis-aligned world rect, the shape Godot culls occluders against. */
export interface LightRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ShadowCasterEdges {
  /**
   * Flat world-space `[ax,ay, bx,by, …]`: four numbers per edge, one pair per
   * endpoint. A closed polygon has already had its wrap-around edge appended.
   */
  segments: ArrayLike<number>;
  cullMode: OccluderCullMode;
  /**
   * The occluder polygon's local AABB, Godot's `aabb_cache`, through the occluder's transform.
   * Godot culls on these bounds, not on the edges (`renderer_viewport.cpp:544`).
   */
  bounds: Quad2;
}

/** Four corners in order around a parallelogram. */
export type Quad2 = readonly [Vector2, Vector2, Vector2, Vector2];

/** The interval `points` cover along `axis`. */
function project(points: ArrayLike<number>, axis: Vector2): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i + 1 < points.length; i += 2) {
    const along = axis.x * points[i]! + axis.y * points[i + 1]!;
    if (along < min) min = along;
    if (along > max) max = along;
  }
  return [min, max];
}

function overlaps([aMin, aMax]: [number, number], [bMin, bMax]: [number, number]): boolean {
  return aMin <= bMax && aMax >= bMin;
}

/** A quad's two edge normals, unnormalised: enough to separate it, as its opposite edges are parallel. */
export function edgeNormals([a, b, c]: Quad2): Vector2[] {
  return [
    { x: a.y - b.y, y: b.x - a.x },
    { x: b.y - c.y, y: c.x - b.x },
  ];
}

/**
 * A test of whether bounds meet the convex `polygon` (`[x,y, …]`), whose edge normals are
 * `polygonAxes`. Both are convex, so a separating axis among the two shapes' edge normals decides
 * it, as Godot's `Rect2::intersects_transformed` does (`renderer_viewport.cpp:544`). The polygon's
 * own intervals are projected once, for every bounds the test meets. Bounds that are not finite
 * meet nothing.
 */
export function convexBoundsTest(
  polygon: ArrayLike<number>,
  polygonAxes: readonly Vector2[]
): (bounds: Quad2) => boolean {
  const polygonIntervals = polygonAxes.map((axis) => project(polygon, axis));
  return (bounds) => {
    const [a, b, c, d] = bounds;
    const corners = [a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y];
    if (!corners.every(Number.isFinite)) return false;
    return (
      polygonAxes.every((axis, index) => overlaps(project(corners, axis), polygonIntervals[index]!)) &&
      edgeNormals(bounds).every((axis) => overlaps(project(corners, axis), project(polygon, axis)))
    );
  };
}

/**
 * Twice the signed area of triangle (light, a, b), with the light at the origin.
 * Zero means the light is collinear with the edge, whichever side of it the light lies on.
 */
function orientation(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

/**
 * Does light-local edge a→b cast a shadow from the light at the origin under `cullMode`? The
 * winding modes take the edges facing toward or away from the light, with signs
 * that negate Godot's Y-down convention. Measured: a closed convex polygon under
 * CULL_COUNTER_CLOCKWISE shadows only from its far edges.
 */
export function edgeCastsShadow(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cullMode: OccluderCullMode
): boolean {
  const orient = orientation(ax, ay, bx, by);
  // A collinear edge has no shadow area, and this also covers a light on the
  // edge's line, in front of it or between its endpoints.
  if (!Number.isFinite(orient) || orient === 0) return false;
  if (cullMode === OccluderPolygon2DCullMode.CLOCKWISE) return orient > 0;
  if (cullMode === OccluderPolygon2DCullMode.COUNTER_CLOCKWISE) return orient < 0;
  return true;
}

const RECT_AXES: readonly Vector2[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
];

/**
 * Godot's occluder cull for one light: the test that keeps an occluder only while its bounds overlap
 * the light's rect (`renderer_canvas_render_rd.cpp:1056`, `p_light_rect.intersects_transformed`).
 */
export function lightRectTest({ minX, minY, maxX, maxY }: LightRect): (bounds: Quad2) => boolean {
  return convexBoundsTest([minX, minY, maxX, minY, maxX, maxY, minX, maxY], RECT_AXES);
}
