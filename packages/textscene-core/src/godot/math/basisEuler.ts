import type { BasisComponents } from './basis.js';
import { atan2Real } from './realAtan2.js';
import { asinf } from './realMath.js';
import type { Vector3 } from './vector.js';

const f = Math.fround;

/** `EulerOrder` (math_defs.h:129): the order the three axis turns apply in. */
export const EulerOrder = { XYZ: 0, XZY: 1, YXZ: 2, YZX: 3, ZXY: 4, ZYX: 5 } as const;

const EPSILON = f(0.00000025);
const NEAR_ONE = f(1 - EPSILON);
const HALF_PI = f(Math.PI / 2);
const ZERO: Vector3 = { x: 0, y: 0, z: 0 };

const euler = (x: number, y: number, z: number): Vector3 => ({ x, y, z });

/** Picks the gimbal-lock branch of one order: inside ±(1 - ε), at +1, or at -1. */
function byPole(
  sine: number,
  inside: () => Vector3,
  atPlusOne: () => Vector3,
  atMinusOne: () => Vector3
): Vector3 {
  if (!(sine < NEAR_ONE)) return atPlusOne();
  return sine > -NEAR_ONE ? inside() : atMinusOne();
}

/**
 * `Basis::get_euler` (basis.cpp:432) in float, and the zero vector for an order outside the enum.
 *
 * @canonical A Basis as Euler angles in float32
 */
export function basisGetEuler(n: BasisComponents, order: number): Vector3 {
  const m = (row: number, col: number) => n[row * 3 + col]!;
  switch (order) {
    case EulerOrder.XYZ:
      return byPole(
        m(0, 2),
        () =>
          m(1, 0) === 0 && m(0, 1) === 0 && m(1, 2) === 0 && m(2, 1) === 0 && m(1, 1) === 1
            ? euler(0, atan2Real(m(0, 2), m(0, 0)), 0)
            : euler(atan2Real(-m(1, 2), m(2, 2)), asinf(m(0, 2)), atan2Real(-m(0, 1), m(0, 0))),
        () => euler(atan2Real(m(2, 1), m(1, 1)), HALF_PI, 0),
        () => euler(atan2Real(m(2, 1), m(1, 1)), -HALF_PI, 0)
      );
    case EulerOrder.XZY:
      return byPole(
        m(0, 1),
        () => euler(atan2Real(m(2, 1), m(1, 1)), atan2Real(m(0, 2), m(0, 0)), asinf(-m(0, 1))),
        () => euler(-atan2Real(m(1, 2), m(2, 2)), 0, -HALF_PI),
        () => euler(-atan2Real(m(1, 2), m(2, 2)), 0, HALF_PI)
      );
    case EulerOrder.YXZ:
      return byPole(
        m(1, 2),
        () =>
          m(1, 0) === 0 && m(0, 1) === 0 && m(0, 2) === 0 && m(2, 0) === 0 && m(0, 0) === 1
            ? euler(atan2Real(-m(1, 2), m(1, 1)), 0, 0)
            : euler(asinf(-m(1, 2)), atan2Real(m(0, 2), m(2, 2)), atan2Real(m(1, 0), m(1, 1))),
        () => euler(-HALF_PI, -atan2Real(m(0, 1), m(0, 0)), 0),
        () => euler(HALF_PI, atan2Real(m(0, 1), m(0, 0)), 0)
      );
    case EulerOrder.YZX:
      return byPole(
        m(1, 0),
        () => euler(atan2Real(-m(1, 2), m(1, 1)), atan2Real(-m(2, 0), m(0, 0)), asinf(m(1, 0))),
        () => euler(atan2Real(m(2, 1), m(2, 2)), 0, HALF_PI),
        () => euler(atan2Real(m(2, 1), m(2, 2)), 0, -HALF_PI)
      );
    case EulerOrder.ZXY:
      return byPole(
        m(2, 1),
        () => euler(asinf(m(2, 1)), atan2Real(-m(2, 0), m(2, 2)), atan2Real(-m(0, 1), m(1, 1))),
        () => euler(HALF_PI, atan2Real(m(0, 2), m(0, 0)), 0),
        () => euler(-HALF_PI, atan2Real(m(0, 2), m(0, 0)), 0)
      );
    case EulerOrder.ZYX:
      return byPole(
        m(2, 0),
        () => euler(atan2Real(m(2, 1), m(2, 2)), asinf(-m(2, 0)), atan2Real(m(1, 0), m(0, 0))),
        () => euler(0, -HALF_PI, -atan2Real(m(0, 1), m(1, 1))),
        () => euler(0, HALF_PI, -atan2Real(m(0, 1), m(1, 1)))
      );
    default:
      return ZERO;
  }
}
