/** The methods of `Vector2` (`core/math/vector2.h`, `vector2.cpp`), in float as `real_t` is. */

import { cMax, cMin, clamp, CMP_EPSILON, round, sign, snapped } from '../../math/math.js';
import { bezierInterpolatef, cubicInterpolatef, cubicInterpolateInTimef, lerpf } from '../../math/math.js';
import { atan2Real } from '../../math/realAtan2.js';
import {
  bezierDerivativef,
  cosf,
  fposmodf,
  isEqualApproxf,
  isEqualWithinf,
  isZeroApproxf,
  sinf,
  sqrtf,
  UNIT_EPSILON,
} from '../../math/realMath.js';
import type { CastArgument } from '../utility/utilityArguments.js';
import { variant, type Variant, type Vector2Value } from '../value/variant.js';
import { methodPort, type MethodParameter, type MethodPort } from './methodPort.js';

const f = Math.fround;
const CMP_EPSILON_FLOAT = f(CMP_EPSILON);

const vector2 = (x: number, y: number): Variant => variant('VECTOR2', { x, y });
const real = (value: number): Variant => variant('FLOAT', value);
const bool = (value: boolean): Variant => variant('BOOL', value);
const AXIS_X = variant('INT', 0n);
const AXIS_Y = variant('INT', 1n);

const self = (base: Variant) => base.value as Vector2Value;
const vectorAt = (args: readonly CastArgument[], index: number) =>
  (args[index] as Variant).value as Vector2Value;
const realAt = (args: readonly CastArgument[], index: number) => args[index] as number;

const dot = (a: Vector2Value, b: Vector2Value) => f(f(a.x * b.x) + f(a.y * b.y));
const cross = (a: Vector2Value, b: Vector2Value) => f(f(a.x * b.y) - f(a.y * b.x));
const lengthSquared = (v: Vector2Value) => dot(v, v);
const length = (v: Vector2Value) => sqrtf(lengthSquared(v));
const minus = (a: Vector2Value, b: Vector2Value): Vector2Value => ({ x: f(a.x - b.x), y: f(a.y - b.y) });
const isNormalized = (v: Vector2Value) => isEqualWithinf(lengthSquared(v), 1, UNIT_EPSILON);

function normalized(v: Vector2Value): Vector2Value {
  const squared = lengthSquared(v);
  if (squared === 0) return v;
  const l = sqrtf(squared);
  return { x: f(v.x / l), y: f(v.y / l) };
}

function rotated({ x, y }: Vector2Value, by: number): Vector2Value {
  const sine = sinf(by);
  const cosine = cosf(by);
  return { x: f(f(x * cosine) - f(y * sine)), y: f(f(x * sine) + f(y * cosine)) };
}

const angleTo = (a: Vector2Value, b: Vector2Value) => atan2Real(cross(a, b), dot(a, b));

// vector2.cpp:173: a normal that is not normalised fails MATH_CHECKS, which an editor build has.
function reflect(v: Vector2Value, normal: Vector2Value): Vector2Value | undefined {
  if (!isNormalized(normal)) return undefined;
  const d = dot(v, normal);
  return { x: f(f(f(2 * normal.x) * d) - v.x), y: f(f(f(2 * normal.y) * d) - v.y) };
}

function slerp(from: Vector2Value, to: Vector2Value, weight: number): Variant {
  const startSquared = lengthSquared(from);
  const endSquared = lengthSquared(to);
  if (startSquared === 0 || endSquared === 0) return each2(from, to, (a, b) => lerpf(a, b, weight));
  const startLength = sqrtf(startSquared);
  const resultLength = lerpf(startLength, sqrtf(endSquared), weight);
  const turned = rotated(from, f(angleTo(from, to) * weight));
  const scale = f(resultLength / startLength);
  return vector2(f(turned.x * scale), f(turned.y * scale));
}

function moveToward(from: Vector2Value, to: Vector2Value, delta: number): Variant {
  const difference = minus(to, from);
  const l = length(difference);
  if (l <= delta || l < CMP_EPSILON_FLOAT) return vector2(to.x, to.y);
  return vector2(f(from.x + f(f(difference.x / l) * delta)), f(from.y + f(f(difference.y / l) * delta)));
}

function limitLength(v: Vector2Value, limit: number): Variant {
  const l = length(v);
  if (!(l > 0 && limit < l)) return vector2(v.x, v.y);
  return vector2(f(f(v.x / l) * limit), f(f(v.y / l) * limit));
}

const each = (v: Vector2Value, map: (component: number) => number) => vector2(map(v.x), map(v.y));
const each2 = (a: Vector2Value, b: Vector2Value, map: (p: number, q: number) => number) =>
  vector2(map(a.x, b.x), map(a.y, b.y));

const V = 'VECTOR2';
const R = 'float';

const unary = (run: (v: Vector2Value) => Variant) => methodPort([], (base) => run(self(base)));
const withVector = (run: (v: Vector2Value, other: Vector2Value) => Variant) =>
  methodPort([V], (base, args) => run(self(base), vectorAt(args, 0)));
const withReal = (run: (v: Vector2Value, scalar: number) => Variant) =>
  methodPort([R], (base, args) => run(self(base), realAt(args, 0)));
const withVectors = (
  parameters: readonly MethodParameter[],
  run: (v: Vector2Value, args: readonly CastArgument[]) => Variant
) => methodPort(parameters, (base, args) => run(self(base), args));

const componentsAt = (args: readonly CastArgument[], count: number) =>
  Array.from({ length: count }, (_, index) => vectorAt(args, index));

export const VECTOR2_METHODS: Readonly<Record<string, MethodPort>> = {
  angle: unary((v) => real(atan2Real(v.y, v.x))),
  angle_to: withVector((v, to) => real(angleTo(v, to))),
  angle_to_point: withVector((v, to) => {
    const d = minus(to, v);
    return real(atan2Real(d.y, d.x));
  }),
  direction_to: withVector((v, to) => {
    const d = normalized(minus(to, v));
    return vector2(d.x, d.y);
  }),
  distance_to: withVector((v, to) => real(length(minus(v, to)))),
  distance_squared_to: withVector((v, to) => real(lengthSquared(minus(v, to)))),
  length: unary((v) => real(length(v))),
  length_squared: unary((v) => real(lengthSquared(v))),
  limit_length: withReal(limitLength),
  normalized: unary((v) => {
    const n = normalized(v);
    return vector2(n.x, n.y);
  }),
  is_normalized: unary((v) => bool(isNormalized(v))),
  is_equal_approx: withVector((v, other) =>
    bool(isEqualApproxf(v.x, other.x) && isEqualApproxf(v.y, other.y))
  ),
  is_zero_approx: unary((v) => bool(isZeroApproxf(v.x) && isZeroApproxf(v.y))),
  is_finite: unary((v) => bool(Number.isFinite(v.x) && Number.isFinite(v.y))),
  posmod: withReal((v, mod) => each(v, (c) => fposmodf(c, mod))),
  posmodv: withVector((v, mod) => each2(v, mod, fposmodf)),
  project: withVector((v, to) => {
    const scale = f(dot(v, to) / lengthSquared(to));
    return vector2(f(to.x * scale), f(to.y * scale));
  }),
  lerp: withVectors([V, R], (v, args) => each2(v, vectorAt(args, 0), (a, b) => lerpf(a, b, realAt(args, 1)))),
  slerp: withVectors([V, R], (v, args) => slerp(v, vectorAt(args, 0), realAt(args, 1))),
  cubic_interpolate: withVectors([V, V, V, R], (v, args) => {
    const [b, pre, post] = componentsAt(args, 3);
    const weight = realAt(args, 3);
    return vector2(
      cubicInterpolatef(v.x, b!.x, pre!.x, post!.x, weight),
      cubicInterpolatef(v.y, b!.y, pre!.y, post!.y, weight)
    );
  }),
  cubic_interpolate_in_time: withVectors([V, V, V, R, R, R, R], (v, args) => {
    const [b, pre, post] = componentsAt(args, 3);
    const [weight, bT, preT, postT] = [3, 4, 5, 6].map((index) => realAt(args, index)) as [
      number,
      number,
      number,
      number,
    ];
    return vector2(
      cubicInterpolateInTimef(v.x, b!.x, pre!.x, post!.x, weight, bT, preT, postT),
      cubicInterpolateInTimef(v.y, b!.y, pre!.y, post!.y, weight, bT, preT, postT)
    );
  }),
  bezier_interpolate: withVectors([V, V, V, R], (v, args) => {
    const [c1, c2, end] = componentsAt(args, 3);
    const t = realAt(args, 3);
    return vector2(
      bezierInterpolatef(v.x, c1!.x, c2!.x, end!.x, t),
      bezierInterpolatef(v.y, c1!.y, c2!.y, end!.y, t)
    );
  }),
  bezier_derivative: withVectors([V, V, V, R], (v, args) => {
    const [c1, c2, end] = componentsAt(args, 3);
    const t = realAt(args, 3);
    return vector2(
      bezierDerivativef(v.x, c1!.x, c2!.x, end!.x, t),
      bezierDerivativef(v.y, c1!.y, c2!.y, end!.y, t)
    );
  }),
  max_axis_index: unary((v) => (v.x < v.y ? AXIS_Y : AXIS_X)),
  min_axis_index: unary((v) => (v.x < v.y ? AXIS_X : AXIS_Y)),
  move_toward: withVectors([V, R], (v, args) => moveToward(v, vectorAt(args, 0), realAt(args, 1))),
  rotated: withReal((v, by) => {
    const r = rotated(v, by);
    return vector2(r.x, r.y);
  }),
  orthogonal: unary((v) => vector2(v.y, -v.x)),
  floor: unary((v) => each(v, Math.floor)),
  ceil: unary((v) => each(v, Math.ceil)),
  round: unary((v) => each(v, round)),
  aspect: unary((v) => real(f(v.x / v.y))),
  dot: withVector((v, other) => real(dot(v, other))),
  slide: withVector((v, normal) => {
    if (!isNormalized(normal)) return vector2(0, 0);
    const d = dot(v, normal);
    return vector2(f(v.x - f(normal.x * d)), f(v.y - f(normal.y * d)));
  }),
  bounce: withVector((v, normal) => {
    const r = reflect(v, normal) ?? { x: 0, y: 0 };
    return vector2(-r.x, -r.y);
  }),
  reflect: withVector((v, normal) => {
    const r = reflect(v, normal) ?? { x: 0, y: 0 };
    return vector2(r.x, r.y);
  }),
  cross: withVector((v, other) => real(cross(v, other))),
  abs: unary((v) => each(v, Math.abs)),
  sign: unary((v) => each(v, sign)),
  clamp: withVectors([V, V], (v, args) => {
    const [min, max] = componentsAt(args, 2);
    return vector2(clamp(v.x, min!.x, max!.x), clamp(v.y, min!.y, max!.y));
  }),
  clampf: withVectors([R, R], (v, args) => each(v, (c) => clamp(c, realAt(args, 0), realAt(args, 1)))),
  snapped: withVector((v, step) => each2(v, step, (c, s) => f(snapped(c, s)))),
  snappedf: withReal((v, step) => each(v, (c) => f(snapped(c, step)))),
  min: withVector((v, other) => each2(v, other, cMin)),
  minf: withReal((v, scalar) => each(v, (c) => cMin(c, scalar))),
  max: withVector((v, other) => each2(v, other, cMax)),
  maxf: withReal((v, scalar) => each(v, (c) => cMax(c, scalar))),
  from_angle: withReal((_v, angle) => vector2(cosf(angle), sinf(angle))),
};
