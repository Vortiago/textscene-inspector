import { lerpf } from '../../math/math.js';
import { atan2Real } from '../../math/realAtan2.js';
import { cosf, sinf, sqrtf } from '../../math/realMath.js';
import type { Variant } from '../value/variant.js';
import {
  axis,
  dot,
  floatVectorMethods,
  geometricVectorMethods,
  lengthSquared,
  minus,
  real,
} from './floatVectorMethods.js';
import type { MethodPort } from './methodPort.js';
import { vectorPorts, type Components } from './vectorPorts.js';

const f = Math.fround;

const { vector, unary, withVector, withScalar, withArguments } = vectorPorts('VECTOR2', 'float');

const cross = ([x, y]: Components, [otherX, otherY]: Components) => f(f(x! * otherY!) - f(y! * otherX!));
const angleTo = (a: Components, b: Components) => atan2Real(cross(a, b), dot(a, b));

// vector2.cpp:52: a zero vector stays as it is, so a negative zero keeps its sign.
function normalized(v: Components): Components {
  const squared = lengthSquared(v);
  if (squared === 0) return v;
  const l = sqrtf(squared);
  return v.map((component) => f(component / l));
}

function rotated([x, y]: Components, by: number): Components {
  const sine = sinf(by);
  const cosine = cosf(by);
  return [f(f(x! * cosine) - f(y! * sine)), f(f(x! * sine) + f(y! * cosine))];
}

function slerp(from: Components, to: Components, weight: number): Variant {
  const startSquared = lengthSquared(from);
  const endSquared = lengthSquared(to);
  if (startSquared === 0 || endSquared === 0) return vector(from.map((c, i) => lerpf(c, to[i]!, weight)));
  const startLength = sqrtf(startSquared);
  const resultLength = lerpf(startLength, sqrtf(endSquared), weight);
  const scale = f(resultLength / startLength);
  return vector(rotated(from, f(angleTo(from, to) * weight)).map((c) => f(c * scale)));
}

export const VECTOR2_METHODS: Readonly<Record<string, MethodPort>> = {
  ...floatVectorMethods('VECTOR2'),
  ...geometricVectorMethods('VECTOR2'),
  normalized: unary((v) => vector(normalized(v))),
  direction_to: withVector((v, to) => vector(normalized(minus(to, v)))),
  angle: unary(([x, y]) => real(atan2Real(y!, x!))),
  angle_to: withVector((v, to) => real(angleTo(v, to))),
  angle_to_point: withVector((v, to) => {
    const [x, y] = minus(to, v);
    return real(atan2Real(y!, x!));
  }),
  slerp: withArguments(['vector', 'scalar'], (v, args) => slerp(v, args.vector(0), args.scalar(1))),
  max_axis_index: unary(([x, y]) => axis(x! < y! ? 1 : 0)),
  min_axis_index: unary(([x, y]) => axis(x! < y! ? 0 : 1)),
  rotated: withScalar((v, by) => vector(rotated(v, by))),
  orthogonal: unary(([x, y]) => vector([y!, -x!])),
  aspect: unary(([x, y]) => real(f(x! / y!))),
  cross: withVector((v, other) => real(cross(v, other))),
  from_angle: withScalar((_v, angle) => vector([cosf(angle), sinf(angle)])),
};
