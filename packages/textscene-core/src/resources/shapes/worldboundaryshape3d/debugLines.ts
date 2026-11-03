/**
 * The editor outline of a WorldBoundaryShape3D: a square in its plane and a ray along its normal.
 * Ported from `world_boundary_shape_3d.cpp:36-63`, as a flat list of line-segment vertices.
 */

import type { Plane } from '../../../godot/math/plane';

/** Half the side of the drawn square (`world_boundary_shape_3d.cpp:45-48`). */
const SQUARE_HALF_SIDE = 10;

/** The length of the ray from the plane's closest point to the origin, along the normal (`:60`). */
const NORMAL_RAY_LENGTH = 3;

/** `Plane::get_any_perpendicular_normal` (`plane.cpp:56-71`): 0.99 is the "too close to x" cut. */
function anyPerpendicularNormal({ x, y, z }: Plane['normal']): [number, number, number] {
  const seed = Math.abs(x) > 0.99 ? [0, 1, 0] : [1, 0, 0];
  const along = x * seed[0]! + y * seed[1]! + z * seed[2]!;
  const px = seed[0]! - x * along;
  const py = seed[1]! - y * along;
  const pz = seed[2]! - z * along;
  const length = Math.hypot(px, py, pz);
  return [px / length, py / length, pz / length];
}

/**
 * `[x, y, z, …]`, ten vertices: four square edges, then the normal ray. A plane with a zero
 * normal yields NaN vertices, which `GizmoLine` leaves undrawn as Godot does.
 */
export function worldBoundaryDebugLines({ normal, d }: Plane): Float32Array {
  const [ax, ay, az] = anyPerpendicularNormal(normal);
  const cx = normal.y * az! - normal.z * ay!;
  const cy = normal.z * ax! - normal.x * az!;
  const cz = normal.x * ay! - normal.y * ax!;
  const crossLength = Math.hypot(cx, cy, cz);
  const bx = cx / crossLength;
  const by = cy / crossLength;
  const bz = cz / crossLength;

  const centre = [normal.x * d, normal.y * d, normal.z * d];
  const corner = (alongA: number, alongB: number) => [
    centre[0]! + ax! * alongA * SQUARE_HALF_SIDE + bx * alongB * SQUARE_HALF_SIDE,
    centre[1]! + ay! * alongA * SQUARE_HALF_SIDE + by * alongB * SQUARE_HALF_SIDE,
    centre[2]! + az! * alongA * SQUARE_HALF_SIDE + bz * alongB * SQUARE_HALF_SIDE,
  ];
  const corners = [corner(1, 1), corner(1, -1), corner(-1, -1), corner(-1, 1)];
  const rayEnd = [
    centre[0]! + normal.x * NORMAL_RAY_LENGTH,
    centre[1]! + normal.y * NORMAL_RAY_LENGTH,
    centre[2]! + normal.z * NORMAL_RAY_LENGTH,
  ];
  const edges = corners.flatMap((from, index) => [...from, ...corners[(index + 1) % 4]!]);
  return Float32Array.from([...edges, ...centre, ...rayEnd]);
}
