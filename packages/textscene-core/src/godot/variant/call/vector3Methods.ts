import type { BasisComponents } from '../../math/basis.js';
import { clamp, lerpf } from '../../math/math.js';
import { atan2Real } from '../../math/realAtan2.js';
import { cosf, sinf, sqrtf } from '../../math/realMath.js';
import { variant, type Variant } from '../value/variant.js';
import {
  axis,
  dot,
  floatVectorMethods,
  geometricVectorMethods,
  isNormalized,
  length,
  lengthSquared,
  normalized,
  real,
  scaled,
} from './floatVectorMethods.js';
import { methodPort, type MethodPort } from './methodPort.js';
import { componentsOf, vectorOf, vectorPorts, type Components } from './vectorPorts.js';

const f = Math.fround;

const { vector, unary, withVector, withArguments } = vectorPorts('VECTOR3', 'float');

const IDENTITY_ROWS: readonly Components[] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

function cross([x, y, z]: Components, [otherX, otherY, otherZ]: Components): Components {
  return [
    f(f(y! * otherZ!) - f(z! * otherY!)),
    f(f(z! * otherX!) - f(x! * otherZ!)),
    f(f(x! * otherY!) - f(y! * otherX!)),
  ];
}

const angleTo = (v: Components, to: Components) => atan2Real(length(cross(v, to)), dot(v, to));

// basis.cpp:840: an axis not normalised fails MATH_CHECKS and leaves the identity basis.
function axisAngleRows(axisVector: Components, angle: number): readonly Components[] {
  if (!isNormalized(axisVector)) return IDENTITY_ROWS;
  const [x, y, z] = axisVector as [number, number, number];
  const cosine = cosf(angle);
  const diagonal = (component: number) => {
    const squared = f(component * component);
    return f(squared + f(cosine * f(1 - squared)));
  };
  const sine = sinf(angle);
  const t = f(1 - cosine);
  const pair = (a: number, b: number, c: number): [number, number] => {
    const product = f(f(a * b) * t);
    const turn = f(c * sine);
    return [f(product - turn), f(product + turn)];
  };
  const [xyMinus, xyPlus] = pair(x, y, z);
  const [xzMinus, xzPlus] = pair(x, z, y);
  const [yzMinus, yzPlus] = pair(y, z, x);
  return [
    [diagonal(x), xyMinus, xzPlus],
    [xyPlus, diagonal(y), yzMinus],
    [xzMinus, yzPlus, diagonal(z)],
  ];
}

const rotated = (v: Components, axisVector: Components, angle: number): Components =>
  axisAngleRows(axisVector, angle).map((row) => dot(row, v));

function slerp(from: Components, to: Components, weight: number): Components {
  const lerped = () => from.map((c, i) => lerpf(c, to[i]!, weight));
  const startSquared = lengthSquared(from);
  const endSquared = lengthSquared(to);
  if (startSquared === 0 || endSquared === 0) return lerped();
  const turnAxis = cross(from, to);
  const axisSquared = lengthSquared(turnAxis);
  if (axisSquared === 0) return lerped();
  const axisLength = sqrtf(axisSquared);
  const unitAxis = turnAxis.map((c) => f(c / axisLength));
  const startLength = sqrtf(startSquared);
  const resultLength = lerpf(startLength, sqrtf(endSquared), weight);
  const turned = rotated(from, unitAxis, f(angleTo(from, to) * weight));
  return scaled(turned, f(resultLength / startLength));
}

const signOf = (value: number) => (value >= 0 ? 1 : -1);

function octahedronEncode(v: Components): Components {
  const [x, y, z] = v.map(Math.abs) as [number, number, number];
  const sum = f(f(x + y) + z);
  const [nx, ny, nz] = v.map((c) => f(c / sum)) as [number, number, number];
  const folded =
    nz >= 0 ? [nx, ny] : [f(f(1 - Math.abs(ny)) * signOf(nx)), f(f(1 - Math.abs(nx)) * signOf(ny))];
  return folded.map((c) => f(f(c * 0.5) + 0.5));
}

function octahedronDecode([octX, octY]: Components): Components {
  const x = f(f(octX! * 2) - 1);
  const y = f(f(octY! * 2) - 1);
  const z = f(f(1 - Math.abs(x)) - Math.abs(y));
  const t = clamp(-z, 0, 1);
  return normalized([f(x + (x >= 0 ? -t : t)), f(y + (y >= 0 ? -t : t)), z]);
}

function outer(v: Components, other: Components): Variant {
  const rows = v.flatMap((c) => other.map((o) => f(c * o)));
  return variant('BASIS', rows as unknown as BasisComponents);
}

export const VECTOR3_METHODS: Readonly<Record<string, MethodPort>> = {
  ...floatVectorMethods('VECTOR3'),
  ...geometricVectorMethods('VECTOR3'),
  min_axis_index: unary(([x, y, z]) => axis(x! < y! ? (x! < z! ? 0 : 2) : y! < z! ? 1 : 2)),
  max_axis_index: unary(([x, y, z]) => axis(x! < y! ? (y! < z! ? 2 : 1) : x! < z! ? 2 : 0)),
  angle_to: withVector((v, to) => real(angleTo(v, to))),
  signed_angle_to: withArguments(['vector', 'vector'], (v, args) => {
    const to = args.vector(0);
    const crossTo = cross(v, to);
    const unsigned = atan2Real(length(crossTo), dot(v, to));
    return real(dot(crossTo, args.vector(1)) < 0 ? -unsigned : unsigned);
  }),
  inverse: unary((v) => vector(v.map((c) => f(1 / c)))),
  rotated: withArguments(['vector', 'scalar'], (v, args) =>
    vector(rotated(v, args.vector(0), args.scalar(1)))
  ),
  slerp: withArguments(['vector', 'scalar'], (v, args) => vector(slerp(v, args.vector(0), args.scalar(1)))),
  cross: withVector((v, other) => vector(cross(v, other))),
  outer: withVector(outer),
  octahedron_encode: unary((v) => vectorOf('VECTOR2', octahedronEncode(v))),
  octahedron_decode: methodPort(['VECTOR2'], (_base, [oct]) =>
    vector(octahedronDecode(componentsOf(oct as Variant)))
  ),
};
