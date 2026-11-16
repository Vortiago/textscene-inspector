import { IDENTITY_BASIS, type BasisComponents } from '../../math/basis.js';
import { basisSetAxisAngle, basisXform } from '../../math/basisFloat.js';
import { vector3Cross } from '../../math/vector.js';
import { clamp, lerpf } from '../../math/math.js';
import { atan2Real } from '../../math/realAtan2.js';
import { sqrtf } from '../../math/realMath.js';
import { variant, type Variant } from '../value/variant.js';
import {
  axis,
  dot,
  floatVectorMethods,
  geometricVectorMethods,
  length,
  lengthSquared,
  lerped,
  normalized,
  real,
  scaled,
} from './floatVectorMethods.js';
import { methodPort, type MethodPort } from './methodPort.js';
import { componentsOf, vectorOf, vectorPorts, type Components } from './vectorPorts.js';

const f = Math.fround;

const { vector, unary, withVector, withArguments } = vectorPorts('VECTOR3', 'float');

const cross = (a: Components, b: Components): Components =>
  vector3Cross(a as [number, number, number], b as [number, number, number]);

const angleTo = (v: Components, to: Components) => atan2Real(length(cross(v, to)), dot(v, to));

function rotated([x, y, z]: Components, [axisX, axisY, axisZ]: Components, angle: number): Components {
  const basis = basisSetAxisAngle([...IDENTITY_BASIS], { x: axisX!, y: axisY!, z: axisZ! }, angle);
  const turned = basisXform(basis, { x: x!, y: y!, z: z! });
  return [turned.x, turned.y, turned.z];
}

function slerp(from: Components, to: Components, weight: number): Components {
  const startSquared = lengthSquared(from);
  const endSquared = lengthSquared(to);
  if (startSquared === 0 || endSquared === 0) return lerped(from, to, weight);
  const turnAxis = cross(from, to);
  const axisSquared = lengthSquared(turnAxis);
  if (axisSquared === 0) return lerped(from, to, weight);
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
