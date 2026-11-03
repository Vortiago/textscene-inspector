/**
 * The editor outline of a WorldBoundaryShape3D: a square in its plane and a ray along its normal.
 * Ported from `world_boundary_shape_3d.cpp:36-63`, as a flat list of line-segment vertices.
 */

import type { Plane } from '../../../../godot/math/plane';
import {
  FLOATS_PER_VERTEX,
  normalizedVector3,
  vector3Add,
  vector3Cross,
  vector3Dot,
  vector3Scaled,
  vector3Sub,
  type Vector3,
} from '../../../../godot/math/vector';

/** Half the side of the drawn square (`world_boundary_shape_3d.cpp:45-48`). */
const SQUARE_HALF_SIDE = 10;

/** The length of the ray from the plane's closest point to the origin, along the normal (`:60`). */
const NORMAL_RAY_LENGTH = 3;

const SQUARE_CORNERS = 4;
const VERTICES = SQUARE_CORNERS * 2 + 2;

/** `Plane::get_any_perpendicular_normal` (`plane.cpp:56-71`): 0.99 is the "too close to x" cut. */
function anyPerpendicularNormal(normal: Vector3): Vector3 {
  const seed = Math.abs(normal.x) > 0.99 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const along = vector3Dot([seed.x, seed.y, seed.z], [normal.x, normal.y, normal.z]);
  const perpendicular = vector3Sub(seed, vector3Scaled(normal, along));
  const [x, y, z] = normalizedVector3(perpendicular.x, perpendicular.y, perpendicular.z);
  return { x, y, z };
}

/**
 * `[x, y, z, …]`, ten vertices: four square edges, then the normal ray. A zero normal gives a
 * zero second axis, as Godot's `normalized()` does, so the square collapses to a line.
 */
export function worldBoundaryOutline({ normal, d }: Plane): Float32Array {
  const first = anyPerpendicularNormal(normal);
  const [bx, by, bz] = normalizedVector3(
    ...vector3Cross([normal.x, normal.y, normal.z], [first.x, first.y, first.z])
  );
  const second = { x: bx, y: by, z: bz };

  const centre = vector3Scaled(normal, d);
  const corner = (alongFirst: number, alongSecond: number) =>
    vector3Add(
      centre,
      vector3Add(
        vector3Scaled(first, alongFirst * SQUARE_HALF_SIDE),
        vector3Scaled(second, alongSecond * SQUARE_HALF_SIDE)
      )
    );
  const corners = [corner(1, 1), corner(1, -1), corner(-1, -1), corner(-1, 1)];

  const vertices = new Float32Array(VERTICES * FLOATS_PER_VERTEX);
  const setVertex = (index: number, { x, y, z }: Vector3) =>
    vertices.set([x, y, z], index * FLOATS_PER_VERTEX);
  corners.forEach((from, index) => {
    setVertex(index * 2, from);
    setVertex(index * 2 + 1, corners[(index + 1) % SQUARE_CORNERS]!);
  });
  setVertex(SQUARE_CORNERS * 2, centre);
  setVertex(SQUARE_CORNERS * 2 + 1, vector3Add(centre, vector3Scaled(normal, NORMAL_RAY_LENGTH)));
  return vertices;
}
