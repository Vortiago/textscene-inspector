import {
  bezierInterpolatef,
  clamp,
  cMax,
  cMin,
  CMP_EPSILON,
  cubicInterpolatef,
  cubicInterpolateInTimef,
  isUnitWithinEpsilon,
  lerpf,
  round,
  sign,
  snapped,
} from '../../math/math.js';
import { bezierDerivativef, fposmodf, isEqualApproxf, isZeroApproxf, sqrtf } from '../../math/realMath.js';
import { variant, type Variant } from '../value/variant.js';
import type { MethodPort } from './methodPort.js';
import { vectorPorts, type Components, type VectorArguments } from './vectorPorts.js';

const f = Math.fround;
const CMP_EPSILON_FLOAT = f(CMP_EPSILON);

export type FloatVectorType = 'VECTOR2' | 'VECTOR3' | 'VECTOR4';

export const real = (value: number): Variant => variant('FLOAT', value);
const bool = (value: boolean): Variant => variant('BOOL', value);
export const axis = (index: number): Variant => variant('INT', BigInt(index));

const each2 = (a: Components, b: Components, map: (p: number, q: number) => number) =>
  a.map((component, index) => map(component, b[index]!));

export const dot = (a: Components, b: Components): number =>
  a.reduce(
    (sum, component, index) => (index === 0 ? sum : f(sum + f(component * b[index]!))),
    f(a[0]! * b[0]!)
  );
export const lengthSquared = (v: Components): number => dot(v, v);
export const length = (v: Components): number => sqrtf(lengthSquared(v));
export const minus = (a: Components, b: Components): Components => each2(a, b, (p, q) => f(p - q));
export const scaled = (v: Components, by: number): Components => v.map((component) => f(component * by));
export const isNormalized = (v: Components): boolean => isUnitWithinEpsilon(lengthSquared(v));

/** `Vector3::normalize` and `Vector4::normalize`: a zero vector becomes positive zeros. */
export function normalized(v: Components): Components {
  const squared = lengthSquared(v);
  if (squared === 0) return v.map(() => 0);
  const l = sqrtf(squared);
  return v.map((component) => f(component / l));
}

// vector2.cpp:186, vector3.h:591: a normal not normalised fails MATH_CHECKS, on in an editor build.
function reflect(v: Components, normal: Components): Components {
  if (!isNormalized(normal)) return v.map(() => 0);
  const d = dot(v, normal);
  return each2(normal, v, (n, c) => f(f(f(2 * n) * d) - c));
}

function slide(v: Components, normal: Components): Components {
  if (!isNormalized(normal)) return v.map(() => 0);
  return minus(v, scaled(normal, dot(v, normal)));
}

function moveToward(from: Components, to: Components, delta: number): Components {
  const difference = minus(to, from);
  const l = length(difference);
  if (l <= delta || l < CMP_EPSILON_FLOAT) return to;
  return each2(from, difference, (c, d) => f(c + f(f(d / l) * delta)));
}

function limitLength(v: Components, limit: number): Components {
  const l = length(v);
  return l > 0 && limit < l ? v.map((c) => f(f(c / l) * limit)) : v;
}

const project = (v: Components, to: Components) => scaled(to, f(dot(v, to) / lengthSquared(to)));

/** `component(self, b, pre, post)` of each axis, for the three vectors and the scalars after them. */
const eachOfFour = (
  self: Components,
  args: VectorArguments,
  component: (a: number, b: number, pre: number, post: number) => number
) => {
  const [b, pre, post] = [0, 1, 2].map(args.vector) as [Components, Components, Components];
  return self.map((a, index) => component(a, b[index]!, pre[index]!, post[index]!));
};

const CUBIC = ['vector', 'vector', 'vector', 'scalar'] as const;
const CUBIC_IN_TIME = ['vector', 'vector', 'vector', 'scalar', 'scalar', 'scalar', 'scalar'] as const;

export function floatVectorMethods(type: FloatVectorType): Readonly<Record<string, MethodPort>> {
  const { vector, unary, withVector, withScalar, withArguments } = vectorPorts(type, 'float');
  return {
    abs: unary((v) => vector(v.map(Math.abs))),
    sign: unary((v) => vector(v.map(sign))),
    floor: unary((v) => vector(v.map(Math.floor))),
    ceil: unary((v) => vector(v.map(Math.ceil))),
    round: unary((v) => vector(v.map(round))),
    length: unary((v) => real(length(v))),
    length_squared: unary((v) => real(lengthSquared(v))),
    normalized: unary((v) => vector(normalized(v))),
    is_normalized: unary((v) => bool(isNormalized(v))),
    is_zero_approx: unary((v) => bool(v.every(isZeroApproxf))),
    is_finite: unary((v) => bool(v.every(Number.isFinite))),
    is_equal_approx: withVector((v, other) => bool(v.every((c, index) => isEqualApproxf(c, other[index]!)))),
    direction_to: withVector((v, to) => vector(normalized(minus(to, v)))),
    distance_to: withVector((v, to) => real(length(minus(to, v)))),
    distance_squared_to: withVector((v, to) => real(lengthSquared(minus(to, v)))),
    dot: withVector((v, other) => real(dot(v, other))),
    posmod: withScalar((v, mod) => vector(v.map((c) => fposmodf(c, mod)))),
    posmodv: withVector((v, mod) => vector(each2(v, mod, fposmodf))),
    snapped: withVector((v, step) => vector(each2(v, step, (c, s) => f(snapped(c, s))))),
    snappedf: withScalar((v, step) => vector(v.map((c) => f(snapped(c, step))))),
    min: withVector((v, other) => vector(each2(v, other, cMin))),
    minf: withScalar((v, scalar) => vector(v.map((c) => cMin(c, scalar)))),
    max: withVector((v, other) => vector(each2(v, other, cMax))),
    maxf: withScalar((v, scalar) => vector(v.map((c) => cMax(c, scalar)))),
    clamp: withArguments(['vector', 'vector'], (v, args) => {
      const [min, max] = [args.vector(0), args.vector(1)];
      return vector(v.map((c, index) => clamp(c, min[index]!, max[index]!)));
    }),
    clampf: withArguments(['scalar', 'scalar'], (v, args) =>
      vector(v.map((c) => clamp(c, args.scalar(0), args.scalar(1))))
    ),
    lerp: withArguments(['vector', 'scalar'], (v, args) =>
      vector(each2(v, args.vector(0), (a, b) => lerpf(a, b, args.scalar(1))))
    ),
    cubic_interpolate: withArguments(CUBIC, (v, args) =>
      vector(eachOfFour(v, args, (a, b, pre, post) => cubicInterpolatef(a, b, pre, post, args.scalar(3))))
    ),
    cubic_interpolate_in_time: withArguments(CUBIC_IN_TIME, (v, args) => {
      const [weight, bT, preT, postT] = [3, 4, 5, 6].map(args.scalar) as [number, number, number, number];
      return vector(
        eachOfFour(v, args, (a, b, pre, post) =>
          cubicInterpolateInTimef(a, b, pre, post, weight, bT, preT, postT)
        )
      );
    }),
  };
}

/** The methods `Vector2` and `Vector3` share beyond those of every real_t vector. */
export function geometricVectorMethods(type: 'VECTOR2' | 'VECTOR3'): Readonly<Record<string, MethodPort>> {
  const { vector, withVector, withScalar, withArguments } = vectorPorts(type, 'float');
  return {
    limit_length: withScalar((v, limit) => vector(limitLength(v, limit))),
    move_toward: withArguments(['vector', 'scalar'], (v, args) =>
      vector(moveToward(v, args.vector(0), args.scalar(1)))
    ),
    project: withVector((v, to) => vector(project(v, to))),
    slide: withVector((v, normal) => vector(slide(v, normal))),
    reflect: withVector((v, normal) => vector(reflect(v, normal))),
    bounce: withVector((v, normal) => vector(reflect(v, normal).map((c) => -c))),
    bezier_interpolate: withArguments(CUBIC, (v, args) =>
      vector(
        eachOfFour(v, args, (start, c1, c2, end) => bezierInterpolatef(start, c1, c2, end, args.scalar(3)))
      )
    ),
    bezier_derivative: withArguments(CUBIC, (v, args) =>
      vector(
        eachOfFour(v, args, (start, c1, c2, end) => bezierDerivativef(start, c1, c2, end, args.scalar(3)))
      )
    ),
  };
}
