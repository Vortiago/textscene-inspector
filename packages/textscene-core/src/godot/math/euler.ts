import { storedReal as f } from './real.js';
import {
  basisDeterminantOf,
  basisDiagonal,
  basisMultiply,
  basisOrthonormalized,
  type BasisComponents,
} from './basis.js';
import type { EnumValue } from '../classdb/enumNames.js';

/** `EulerOrder` (`core/math/math_defs.h:129-136`). */
export const EulerOrder = {
  XYZ: 0,
  XZY: 1,
  YXZ: 2,
  YZX: 3,
  ZXY: 4,
  ZYX: 5,
} as const;

export type EulerAngles = readonly [x: number, y: number, z: number];

/** The angle `get_euler` rounds to the pole within (`basis.cpp:459`). */
const POLE_EPSILON = f(0.00000025);
const HALF_PI = f(Math.PI / 2);

const atan2 = (y: number, x: number) => f(Math.atan2(y, x));
const asin = (x: number) => f(Math.asin(x));

function rotationX(angle: number): BasisComponents {
  const c = f(Math.cos(angle));
  const s = f(Math.sin(angle));
  return [1, 0, 0, 0, c, -s, 0, s, c];
}

function rotationY(angle: number): BasisComponents {
  const c = f(Math.cos(angle));
  const s = f(Math.sin(angle));
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}

function rotationZ(angle: number): BasisComponents {
  const c = f(Math.cos(angle));
  const s = f(Math.sin(angle));
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

/** `Basis::from_euler` (`basis.cpp:656-692`). */
export function basisFromEuler([x, y, z]: EulerAngles, order: EnumValue<typeof EulerOrder>): BasisComponents {
  const [xm, ym, zm] = [rotationX(x), rotationY(y), rotationZ(z)];
  switch (order) {
    case EulerOrder.XYZ:
      return basisMultiply(xm, basisMultiply(ym, zm));
    case EulerOrder.XZY:
      return basisMultiply(basisMultiply(xm, zm), ym);
    case EulerOrder.YXZ:
      return basisMultiply(basisMultiply(ym, xm), zm);
    case EulerOrder.YZX:
      return basisMultiply(basisMultiply(ym, zm), xm);
    case EulerOrder.ZXY:
      return basisMultiply(basisMultiply(zm, xm), ym);
    case EulerOrder.ZYX:
      return basisMultiply(basisMultiply(zm, ym), xm);
  }
  throw new Error(`expected an Euler order from 0 to 5, got ${order}`);
}

/** `Basis::set_euler_scale` (`basis.cpp:875-878`): the rotation applied after the scale. */
export function basisFromEulerScale(
  euler: EulerAngles,
  [sx, sy, sz]: EulerAngles,
  order: EnumValue<typeof EulerOrder>
): BasisComponents {
  return basisMultiply(basisFromEuler(euler, order), basisDiagonal(sx, sy, sz));
}

/** Where a pole test of `get_euler` lands: inside the band, at +1, or at -1. */
function poleOf(value: number): 'inside' | 'plus' | 'minus' {
  if (value >= f(1 - POLE_EPSILON)) return 'plus';
  return value > -f(1 - POLE_EPSILON) ? 'inside' : 'minus';
}

/** `Basis::get_euler` (`basis.cpp:455-654`), with `r(row, column)` the component it reads. */
export function basisGetEuler(n: BasisComponents, order: EnumValue<typeof EulerOrder>): EulerAngles {
  const r = (row: number, column: number): number => n[row * 3 + column]!;
  switch (order) {
    case EulerOrder.XYZ: {
      const pole = poleOf(r(0, 2));
      if (pole === 'plus') return [atan2(r(2, 1), r(1, 1)), HALF_PI, 0];
      if (pole === 'minus') return [atan2(r(2, 1), r(1, 1)), -HALF_PI, 0];
      const isPureY = r(1, 0) === 0 && r(0, 1) === 0 && r(1, 2) === 0 && r(2, 1) === 0 && r(1, 1) === 1;
      if (isPureY) return [0, atan2(r(0, 2), r(0, 0)), 0];
      return [atan2(-r(1, 2), r(2, 2)), asin(r(0, 2)), atan2(-r(0, 1), r(0, 0))];
    }
    case EulerOrder.XZY: {
      const pole = poleOf(r(0, 1));
      if (pole === 'plus') return [-atan2(r(1, 2), r(2, 2)), 0, -HALF_PI];
      if (pole === 'minus') return [-atan2(r(1, 2), r(2, 2)), 0, HALF_PI];
      return [atan2(r(2, 1), r(1, 1)), atan2(r(0, 2), r(0, 0)), asin(-r(0, 1))];
    }
    case EulerOrder.YXZ: {
      const pole = poleOf(r(1, 2));
      if (pole === 'plus') return [-HALF_PI, -atan2(r(0, 1), r(0, 0)), 0];
      if (pole === 'minus') return [HALF_PI, atan2(r(0, 1), r(0, 0)), 0];
      const isPureX = r(1, 0) === 0 && r(0, 1) === 0 && r(0, 2) === 0 && r(2, 0) === 0 && r(0, 0) === 1;
      if (isPureX) return [atan2(-r(1, 2), r(1, 1)), 0, 0];
      return [asin(-r(1, 2)), atan2(r(0, 2), r(2, 2)), atan2(r(1, 0), r(1, 1))];
    }
    case EulerOrder.YZX: {
      const pole = poleOf(r(1, 0));
      if (pole === 'plus') return [atan2(r(2, 1), r(2, 2)), 0, HALF_PI];
      if (pole === 'minus') return [atan2(r(2, 1), r(2, 2)), 0, -HALF_PI];
      return [atan2(-r(1, 2), r(1, 1)), atan2(-r(2, 0), r(0, 0)), asin(r(1, 0))];
    }
    case EulerOrder.ZXY: {
      const pole = poleOf(r(2, 1));
      if (pole === 'plus') return [HALF_PI, atan2(r(0, 2), r(0, 0)), 0];
      if (pole === 'minus') return [-HALF_PI, atan2(r(0, 2), r(0, 0)), 0];
      return [asin(r(2, 1)), atan2(-r(2, 0), r(2, 2)), atan2(-r(0, 1), r(1, 1))];
    }
    case EulerOrder.ZYX: {
      const pole = poleOf(r(2, 0));
      if (pole === 'plus') return [0, -HALF_PI, -atan2(r(0, 1), r(1, 1))];
      if (pole === 'minus') return [0, HALF_PI, -atan2(r(0, 1), r(1, 1))];
      return [atan2(r(2, 1), r(2, 2)), asin(-r(2, 0)), atan2(r(1, 0), r(0, 0))];
    }
  }
  throw new Error(`expected an Euler order from 0 to 5, got ${order}`);
}

/** `Basis::get_euler_normalized` (`basis.cpp:385-397`): the angles of the rotation `get_scale` leaves. */
export function basisGetEulerNormalized(
  n: BasisComponents,
  order: EnumValue<typeof EulerOrder>
): EulerAngles {
  const m = basisOrthonormalized(n);
  const proper = basisDeterminantOf(m) < 0 ? (m.map((c) => -c) as unknown as BasisComponents) : m;
  return basisGetEuler(proper, order);
}
