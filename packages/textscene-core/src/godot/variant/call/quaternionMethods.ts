import { basisFromQuaternion, basisGetRotationQuaternion } from '../../math/basis.js';
import { basisGetEuler } from '../../math/basisEuler.js';
import {
  CMP_EPSILON,
  cubicInterpolatef,
  cubicInterpolateInTimef,
  isUnitWithinEpsilon,
} from '../../math/math.js';
import {
  normalizedQuaternion,
  QUATERNION_IDENTITY,
  quaternionDot,
  quaternionFromAxisAngle,
  quaternionInverse,
  quaternionIsNormalized,
  quaternionMultiply,
  quaternionSlerp,
  type Quaternion,
} from '../../math/quaternion.js';
import { acosf, cosf, isEqualApproxf, sinf, sqrtf } from '../../math/realMath.js';
import { normalizedVector3, vector3Length, vector3LengthSquared, type Vector3 } from '../../math/vector.js';
import type { CastArgument } from '../utility/utilityArguments.js';
import { variant, type Variant } from '../value/variant.js';
import { methodPort, type MethodParameter, type MethodPort } from './methodPort.js';

const f = Math.fround;
const LANES = ['x', 'y', 'z', 'w'] as const;
const ZERO_QUATERNION: Quaternion = { x: 0, y: 0, z: 0, w: 0 };
const ZERO_VECTOR: Vector3 = { x: 0, y: 0, z: 0 };

const quaternionOf = (q: Quaternion): Variant => variant('QUATERNION', q);
const vectorOf = (v: Vector3): Variant => variant('VECTOR3', v);
const real = (value: number): Variant => variant('FLOAT', value);
const bool = (value: boolean): Variant => variant('BOOL', value);
const quaternionAt = (args: readonly CastArgument[], index: number) =>
  (args[index] as Variant).value as Quaternion;
const numberAt = (args: readonly CastArgument[], index: number) => args[index] as number;

const port = (
  parameters: readonly MethodParameter[],
  body: (q: Quaternion, args: readonly CastArgument[]) => Variant
) => methodPort(parameters, (base, args) => body(base.value as Quaternion, args));

const negated = (q: Quaternion): Quaternion => ({ x: -q.x, y: -q.y, z: -q.z, w: -q.w });

// quaternion.cpp:79: MATH_CHECKS gives `Quaternion()` for a quaternion that is not normalised.
const checkedInverse = (q: Quaternion) =>
  quaternionIsNormalized(q) ? quaternionInverse(q) : QUATERNION_IDENTITY;

function axisOf({ x, y, z, w }: Quaternion): Vector3 {
  if (Math.abs(w) > 1 - CMP_EPSILON) return { x, y, z };
  const scale = f(1 / sqrtf(f(1 - f(w * w))));
  return { x: f(x * scale), y: f(y * scale), z: f(z * scale) };
}

const angleOf = (q: Quaternion) => f(2 * acosf(q.w));

function log(q: Quaternion): Quaternion {
  const angle = angleOf(q);
  const { x, y, z } = axisOf(q);
  return { x: f(x * angle), y: f(y * angle), z: f(z * angle), w: 0 };
}

function exp({ x, y, z }: Quaternion): Quaternion {
  const theta = vector3Length(x, y, z);
  const [ux, uy, uz] = normalizedVector3(x, y, z);
  if (theta < CMP_EPSILON || !isUnitWithinEpsilon(vector3LengthSquared(ux, uy, uz)))
    return QUATERNION_IDENTITY;
  return quaternionFromAxisAngle({ x: ux, y: uy, z: uz }, theta);
}

function slerpni(from: Quaternion, to: Quaternion, weight: number): Quaternion {
  if (!quaternionIsNormalized(from) || !quaternionIsNormalized(to)) return QUATERNION_IDENTITY;
  const dot = quaternionDot(from, to);
  if (Math.abs(dot) > f(0.9999)) return from;
  const theta = acosf(dot);
  const inverseSine = f(1 / sinf(theta));
  const toFactor = f(sinf(f(weight * theta)) * inverseSine);
  const fromFactor = f(sinf(f(f(1 - weight) * theta)) * inverseSine);
  const lane = (name: (typeof LANES)[number]) => f(f(fromFactor * from[name]) + f(toFactor * to[name]));
  return { x: lane('x'), y: lane('y'), z: lane('z'), w: lane('w') };
}

type Interpolate = (from: number, to: number, pre: number, post: number) => number;

const rotationOf = (q: Quaternion) => basisGetRotationQuaternion(basisFromQuaternion(q));

// A NaN reads as positive: Godot's NAN constant carries no sign bit, and arithmetic keeps it.
const signBit = (value: number) => value < 0 || Object.is(value, -0);

const relativeLog = (start: Quaternion, end: Quaternion) =>
  log(quaternionMultiply(checkedInverse(start), end));

/** One end of the spherical cubic: the logs of the other three seen from `start`, interpolated. */
function cubicEnd(start: Quaternion, logs: readonly Quaternion[], interpolate: Interpolate): Quaternion {
  const [from, to, pre, post] = logs as [Quaternion, Quaternion, Quaternion, Quaternion];
  const lane = (name: 'x' | 'y' | 'z') => interpolate(from[name], to[name], pre[name], post[name]);
  return quaternionMultiply(start, exp({ x: lane('x'), y: lane('y'), z: lane('z'), w: 0 }));
}

function sphericalCubic(
  self: Quaternion,
  args: readonly CastArgument[],
  weight: number,
  interpolate: Interpolate
): Quaternion {
  const [b, preA, postB] = [0, 1, 2].map((index) => quaternionAt(args, index)) as [
    Quaternion,
    Quaternion,
    Quaternion,
  ];
  if (!quaternionIsNormalized(self) || !quaternionIsNormalized(b)) return QUATERNION_IDENTITY;
  const from = rotationOf(self);
  let [pre, to, post] = [rotationOf(preA), rotationOf(b), rotationOf(postB)];
  if (signBit(quaternionDot(from, pre))) pre = negated(pre);
  const isToFlipped = signBit(quaternionDot(from, to));
  if (isToFlipped) to = negated(to);
  if (isToFlipped ? quaternionDot(to, post) <= 0 : signBit(quaternionDot(to, post))) post = negated(post);
  const first = cubicEnd(
    from,
    [ZERO_QUATERNION, relativeLog(from, to), relativeLog(from, pre), relativeLog(from, post)],
    interpolate
  );
  const second = cubicEnd(
    to,
    [relativeLog(to, from), ZERO_QUATERNION, relativeLog(to, pre), relativeLog(to, post)],
    interpolate
  );
  return quaternionSlerp(first, second, weight);
}

function fromEuler({ x, y, z }: Vector3): Quaternion {
  const [halfY, halfX, halfZ] = [f(y * 0.5), f(x * 0.5), f(z * 0.5)];
  const [c1, s1, c2, s2, c3, s3] = [
    cosf(halfY),
    sinf(halfY),
    cosf(halfX),
    sinf(halfX),
    cosf(halfZ),
    sinf(halfZ),
  ];
  const product = (a: number, b: number, c: number) => f(f(a * b) * c);
  return {
    x: f(product(s1, c2, s3) + product(c1, s2, c3)),
    y: f(product(s1, c2, c3) - product(c1, s2, s3)),
    z: f(product(-s1, s2, c3) + product(c1, c2, s3)),
    w: f(product(s1, s2, s3) + product(c1, c2, c3)),
  };
}

const lengthSquared = (q: Quaternion) => quaternionDot(q, q);

export const QUATERNION_METHODS: Readonly<Record<string, MethodPort>> = {
  length: port([], (q) => real(sqrtf(lengthSquared(q)))),
  length_squared: port([], (q) => real(lengthSquared(q))),
  normalized: port([], (q) => quaternionOf(normalizedQuaternion(q))),
  is_normalized: port([], (q) => bool(quaternionIsNormalized(q))),
  is_equal_approx: port(['QUATERNION'], (q, args) => {
    const other = quaternionAt(args, 0);
    return bool(LANES.every((lane) => isEqualApproxf(q[lane], other[lane])));
  }),
  is_finite: port([], (q) => bool(LANES.every((lane) => Number.isFinite(q[lane])))),
  inverse: port([], (q) => quaternionOf(checkedInverse(q))),
  log: port([], (q) => quaternionOf(log(q))),
  exp: port([], (q) => quaternionOf(exp(q))),
  angle_to: port(['QUATERNION'], (q, args) => {
    const dot = quaternionDot(q, quaternionAt(args, 0));
    return real(acosf(f(f(f(dot * dot) * 2) - 1)));
  }),
  dot: port(['QUATERNION'], (q, args) => real(quaternionDot(q, quaternionAt(args, 0)))),
  slerp: port(['QUATERNION', 'float'], (q, args) =>
    quaternionOf(quaternionSlerp(q, quaternionAt(args, 0), numberAt(args, 1)))
  ),
  slerpni: port(['QUATERNION', 'float'], (q, args) =>
    quaternionOf(slerpni(q, quaternionAt(args, 0), numberAt(args, 1)))
  ),
  spherical_cubic_interpolate: port(['QUATERNION', 'QUATERNION', 'QUATERNION', 'float'], (q, args) => {
    const weight = numberAt(args, 3);
    return quaternionOf(
      sphericalCubic(q, args, weight, (from, to, pre, post) => cubicInterpolatef(from, to, pre, post, weight))
    );
  }),
  spherical_cubic_interpolate_in_time: port(
    ['QUATERNION', 'QUATERNION', 'QUATERNION', 'float', 'float', 'float', 'float'],
    (q, args) => {
      const [weight, toT, preT, postT] = [3, 4, 5, 6].map((index) => numberAt(args, index)) as [
        number,
        number,
        number,
        number,
      ];
      return quaternionOf(
        sphericalCubic(q, args, weight, (from, to, pre, post) =>
          cubicInterpolateInTimef(from, to, pre, post, weight, toT, preT, postT)
        )
      );
    }
  ),
  get_euler: port(['EulerOrder'], (q, args) =>
    vectorOf(
      quaternionIsNormalized(q) ? basisGetEuler(basisFromQuaternion(q), numberAt(args, 0)) : ZERO_VECTOR
    )
  ),
  from_euler: methodPort(['VECTOR3'], (_base, [euler]) =>
    quaternionOf(fromEuler((euler as Variant).value as Vector3))
  ),
  get_axis: port([], (q) => vectorOf(axisOf(q))),
  get_angle: port([], (q) => real(angleOf(q))),
};
