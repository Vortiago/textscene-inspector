/**
 * The occluder resources of an OccluderInstance3D, and the box `Occluder3D::get_aabb` gives for
 * each: the box of the vertices its mesh builds, grown from `AABB()` (`occluder_instance_3d.cpp:50-58`).
 * The origin is therefore in every box.
 */

import { aabbOfPoints, EMPTY_AABB, type Aabb } from '../math/aabb';
import { TAU } from '../math/math';
import { triangulatePolygon } from '../math/triangulate';
import type { Vector2, Vector3 } from '../math/vector';

export type OccluderShape =
  | { kind: 'box'; size: Vector3 }
  | { kind: 'quad'; size: Vector2 }
  | { kind: 'sphere'; radius: number }
  | { kind: 'polygon'; polygon: readonly Vector2[] }
  | { kind: 'array'; vertices: ArrayLike<number> };

/** `SphereOccluder3D::RINGS` and `RADIAL_SEGMENTS` (`occluder_instance_3d.h:125-126`). */
const SPHERE_RINGS = 7;
const SPHERE_RADIAL_SEGMENTS = 7;

/** The setters clamp each size component at 0 (`occluder_instance_3d.cpp:190, 234, 300`). */
const atLeastZero = (value: number) => Math.max(value, 0);

function boxVertices({ x, y, z }: Vector3): number[] {
  const [hx, hy, hz] = [atLeastZero(x) / 2, atLeastZero(y) / 2, atLeastZero(z) / 2];
  return [-hx, -hy, hz, hx, hy, -hz];
}

function quadVertices({ x, y }: Vector2): number[] {
  const [hx, hy] = [atLeastZero(x) / 2, atLeastZero(y) / 2];
  return [-hx, -hy, 0, hx, hy, 0];
}

/** `SphereOccluder3D::_update_arrays` (`occluder_instance_3d.cpp:310-349`), vertices only. */
function sphereVertices(radius: number): number[] {
  const scale = atLeastZero(radius);
  const vertices: number[] = [];
  for (let ring = 0; ring <= SPHERE_RINGS + 1; ring++) {
    const v = ring / (SPHERE_RINGS + 1);
    const ringRadius = Math.sin(Math.PI * v);
    const y = Math.cos(Math.PI * v);
    for (let segment = 0; segment <= SPHERE_RADIAL_SEGMENTS; segment++) {
      const u = segment / SPHERE_RADIAL_SEGMENTS;
      vertices.push(
        Math.cos(u * TAU) * ringRadius * scale,
        y * scale,
        Math.sin(u * TAU) * ringRadius * scale
      );
    }
  }
  return vertices;
}

/** `PolygonOccluder3D::_update_arrays` (`occluder_instance_3d.cpp:375-408`): no vertex when it cannot triangulate. */
function polygonVertices(polygon: readonly Vector2[]): number[] {
  if (triangulatePolygon(polygon).length < 3) return [];
  return polygon.flatMap(({ x, y }) => [x, y, 0]);
}

function shapeVertices(shape: OccluderShape): number[] {
  switch (shape.kind) {
    case 'box':
      return boxVertices(shape.size);
    case 'quad':
      return quadVertices(shape.size);
    case 'sphere':
      return sphereVertices(shape.radius);
    case 'polygon':
      return polygonVertices(shape.polygon);
    case 'array':
      return Array.from(shape.vertices);
  }
}

/** `Occluder3D::get_aabb` (`occluder_instance_3d.cpp:120-122`). */
export function occluderAabb(shape: OccluderShape): Aabb {
  const vertices = shapeVertices(shape);
  return vertices.length === 0 ? EMPTY_AABB : aabbOfPoints([0, 0, 0, ...vertices]);
}
