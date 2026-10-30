/**
 * The three great circles of the GPU particles collision and attractor sphere gizmo
 * (`gpu_particles_collision_3d_gizmo_plugin.cpp:167-232`).
 */

import { storedReal as f } from '../../godot/math/real';

/** A signed corner of a quarter: the sign each coordinate takes, in the order the PUSH_QUARTER macros write them. */
type Corner = readonly [sx: 1 | -1, sy: 1 | -1];

interface Plane {
  corners: readonly Corner[];
  point: (u: number, v: number) => number[];
}

/** The corner order of `PUSH_QUARTER_XY` and `PUSH_QUARTER_YZ` (`:181-198`). */
const SIGNED_Y_FIRST: readonly Corner[] = [
  [1, -1],
  [1, 1],
  [-1, -1],
  [-1, 1],
];

/** The circle planes of `PUSH_QUARTER`, `PUSH_QUARTER_XY` and `PUSH_QUARTER_YZ` (`:170-198`). */
const PLANES: readonly Plane[] = [
  {
    corners: [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ],
    point: (u, v) => [u, 0, v],
  },
  { corners: SIGNED_Y_FIRST, point: (u, v) => [u, v, 0] },
  { corners: SIGNED_Y_FIRST, point: (u, v) => [0, v, u] },
];

const POINTS_IN_OCTANT = 16;
const OCTANT_ANGLE = f(Math.PI / 4);
const ANGLE_STEP = f(Math.PI / (4 * POINTS_IN_OCTANT));

/** The four mirrored segments of one quarter step, in all four quadrants of a plane. */
function quarterSegments(
  plane: Plane,
  from: readonly [number, number],
  to: readonly [number, number]
): number[] {
  return plane.corners.flatMap(([sx, sy]) => [
    ...plane.point(sx * from[0], sy * from[1]),
    ...plane.point(sx * to[0], sy * to[1]),
  ]);
}

/**
 * Flat `xyz` segment ends of the circles of `radius` in the XZ, XY and YZ planes. The engine computes
 * in `float`, so each step rounds. No radius is refused: 0 collapses the circles to the origin.
 *
 * @canonical The three great circles of a sphere gizmo
 */
export function sphereCircleLines(radius: number): number[] {
  const radiusSquared = f(radius * radius);
  const lines: number[] = [];
  let angle = 0;
  let previous: [number, number] = [f(radius), 0];
  for (let step = 0; step < POINTS_IN_OCTANT; step++) {
    angle = f(angle + ANGLE_STEP);
    const x = f(f(Math.cos(step === POINTS_IN_OCTANT - 1 ? OCTANT_ANGLE : angle)) * radius);
    const y = f(Math.sqrt(f(radiusSquared - f(x * x))));
    const current: [number, number] = [x, y];
    for (const plane of PLANES) {
      lines.push(...quarterSegments(plane, previous, current));
      lines.push(...quarterSegments(plane, [previous[1], previous[0]], [y, x]));
    }
    previous = current;
  }
  return lines;
}
