import { basisMultiply, IDENTITY_BASIS, type BasisComponents } from './basis.js';
import { EulerOrder } from './euler.js';
import { atan2Real } from './realAtan2.js';
import { asinf, cosf, sinf } from './realMath.js';
import { VECTOR3_ZERO, type Vector3 } from './vector.js';

const f = Math.fround;

const EPSILON = f(0.00000025);
const NEAR_ONE = f(1 - EPSILON);
const HALF_PI = f(Math.PI / 2);

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
      return VECTOR3_ZERO;
  }
}

/**
 * `Basis::from_euler` (basis.h:85) in float, and the identity for an order outside the enum.
 *
 * @canonical Euler angles as a Basis in float32
 */
export function basisFromEuler({ x, y, z }: Vector3, order: number): BasisComponents {
  const [cx, sx, cy, sy, cz, sz] = [cosf(x), sinf(x), cosf(y), sinf(y), cosf(z), sinf(z)];
  const xTurn: BasisComponents = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
  const yTurn: BasisComponents = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  const zTurn: BasisComponents = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  const times = basisMultiply;
  switch (order) {
    case EulerOrder.XYZ:
      return times(xTurn, times(yTurn, zTurn));
    case EulerOrder.XZY:
      return times(times(xTurn, zTurn), yTurn);
    case EulerOrder.YXZ:
      return times(times(yTurn, xTurn), zTurn);
    case EulerOrder.YZX:
      return times(times(yTurn, zTurn), xTurn);
    case EulerOrder.ZXY:
      return times(times(zTurn, xTurn), yTurn);
    case EulerOrder.ZYX:
      return times(times(zTurn, yTurn), xTurn);
    default:
      return IDENTITY_BASIS;
  }
}
