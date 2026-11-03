/**
 * What the sky coordinates gate requires: Godot's `SKY_COORDS` at each eye direction, from its
 * `atan2_approx` and `acos_approx` (`sky.glsl:179-201`, `:226-232`), worked out in double precision.
 * The exact `atan` and `acos` miss the V of every direction off the horizon and the poles.
 */

/** Each eye direction the page evaluates, and Godot's (u, v) for it. */
export const SKY_COORDS_CASES = [
  { direction: [0, 0, -1], coords: [0, 0.5] },
  // 0.1 rad above the horizon, where V falls at 0.942/π a radian and not 1/π: the exact V is 0.468169.
  { direction: [0, 0.0998334, -0.9950042], coords: [0, 0.469665] },
  // A negative u wraps by a turn.
  { direction: [-1, 0, 0], coords: [0.75, 0.5] },
  { direction: [0.6, -0.48, 0.64], coords: [0.380321, 0.656697] },
  { direction: [0.3, 0.8, 0.52], coords: [0.416518, 0.205861] },
  { direction: [0.2, 0.3, -0.9], coords: [0.034848, 0.402688] },
];

/** A float32 evaluation and the six digits of each literal above. */
const TOLERANCE = 2e-6;

/** One message for each case whose evaluated coordinates stray from Godot's. */
export function skyCoordsFailures(evaluated) {
  return SKY_COORDS_CASES.flatMap(({ direction, coords }, index) => {
    const found = evaluated[index];
    const isClose = found && coords.every((expected, axis) => Math.abs(found[axis] - expected) <= TOLERANCE);
    if (isClose) return [];
    return [
      `direction ${direction.join(', ')}: expected coords ${coords.join(', ')}, got ${found?.join(', ')}`,
    ];
  });
}
