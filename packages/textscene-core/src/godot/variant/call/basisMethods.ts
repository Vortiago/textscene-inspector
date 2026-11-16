import {
  basisColumn,
  basisDeterminantOf,
  basisFromColumns,
  basisFromQuaternion,
  basisGetQuaternion,
  basisGetRotationQuaternion,
  basisGetScale,
  basisInvert,
  basisMultiply,
  basisOrthonormalized,
  IDENTITY_BASIS,
  type BasisComponents,
  type MutableBasis,
} from '../../math/basis.js';
import { basisFromEuler, basisGetEuler } from '../../math/basisEuler.js';
import { basisScale, basisSetAxisAngle } from '../../math/basisFloat.js';
import { lerpf } from '../../math/math.js';
import { quaternionSlerp } from '../../math/quaternion.js';
import { isEqualApproxf, isZeroApproxf } from '../../math/realMath.js';
import {
  normalizedVector3,
  vector3Cross,
  vector3DotComponents,
  vector3Length,
  type Vector3,
} from '../../math/vector.js';
import { anyPerpendicular } from '../construct/rotations.js';
import { transposeBasis } from '../operators/matrices.js';
import type { CastArgument } from '../utility/utilityArguments.js';
import { variant, type Variant } from '../value/variant.js';
import { methodPort, type MethodParameter, type MethodPort } from './methodPort.js';

const f = Math.fround;

const basisOf = (n: BasisComponents): Variant => variant('BASIS', n);
const vectorOf = (v: Vector3): Variant => variant('VECTOR3', v);
const real = (value: number): Variant => variant('FLOAT', value);
const bool = (value: boolean): Variant => variant('BOOL', value);
const basisAt = (args: readonly CastArgument[], index: number) =>
  (args[index] as Variant).value as BasisComponents;
const vectorAt = (args: readonly CastArgument[], index: number) => (args[index] as Variant).value as Vector3;
const vector = ([x, y, z]: readonly number[]): Vector3 => ({ x: x!, y: y!, z: z! });
const tuple = ({ x, y, z }: Vector3) => [x, y, z] as const;

const port = (
  parameters: readonly MethodParameter[],
  body: (n: BasisComponents, args: readonly CastArgument[]) => Variant
) => methodPort(parameters, (base, args) => body(base.value as BasisComponents, args));

const rowLength = (n: BasisComponents, row: number) =>
  vector3Length(n[row * 3]!, n[row * 3 + 1]!, n[row * 3 + 2]!);

const columnDot = (n: BasisComponents, column: number, v: Vector3) =>
  vector3DotComponents(n[column]!, n[column + 3]!, n[column + 6]!, v.x, v.y, v.z);

function slerp(n: BasisComponents, to: BasisComponents, weight: number): BasisComponents {
  const turned = basisFromQuaternion(quaternionSlerp(basisGetQuaternion(n), basisGetQuaternion(to), weight));
  const [x, y, z] = [0, 1, 2].map((row) => lerpf(rowLength(n, row), rowLength(to, row), weight));
  return basisScale([...turned] as MutableBasis, x!, y!, z!);
}

function isConformal(n: BasisComponents): boolean {
  const [x, y, z] = [0, 1, 2].map((index) => basisColumn(n, index));
  const dot = (a: readonly number[], b: readonly number[]) =>
    vector3DotComponents(a[0]!, a[1]!, a[2]!, b[0]!, b[1]!, b[2]!);
  const xLengthSquared = dot(x!, x!);
  return (
    isEqualApproxf(xLengthSquared, dot(y!, y!)) &&
    isEqualApproxf(xLengthSquared, dot(z!, z!)) &&
    isZeroApproxf(dot(x!, y!)) &&
    isZeroApproxf(dot(x!, z!)) &&
    isZeroApproxf(dot(y!, z!))
  );
}

const isZeroApproxVector = ({ x, y, z }: Vector3) => isZeroApproxf(x) && isZeroApproxf(y) && isZeroApproxf(z);
const negated = ({ x, y, z }: Vector3): Vector3 => ({ x: -x, y: -y, z: -z });
const normalized = (v: Vector3) => vector(normalizedVector3(v.x, v.y, v.z));

// basis.cpp:1029: MATH_CHECKS gives `Basis()` for a zero target or up.
function lookingAt(target: Vector3, up: Vector3, isModelFront: boolean): BasisComponents {
  if (isZeroApproxVector(target) || isZeroApproxVector(up)) return IDENTITY_BASIS;
  const forward = isModelFront ? normalized(target) : negated(normalized(target));
  let side = vector(vector3Cross(tuple(up), tuple(forward)));
  if (isZeroApproxVector(side)) side = anyPerpendicular(up);
  side = normalized(side);
  return basisFromColumns(side, vector(vector3Cross(tuple(forward), tuple(side))), forward);
}

function rotated(n: BasisComponents, axis: Vector3, angle: number): BasisComponents {
  return basisMultiply(basisSetAxisAngle([...IDENTITY_BASIS], axis, angle), n);
}

const scaledLocal = (n: BasisComponents, { x, y, z }: Vector3): BasisComponents =>
  n.map((component, index) => f(component * [x, y, z][index % 3]!)) as unknown as BasisComponents;

export const BASIS_METHODS: Readonly<Record<string, MethodPort>> = {
  inverse: port([], (n) => basisOf(basisInvert(n))),
  transposed: port([], (n) => basisOf(transposeBasis(n))),
  orthonormalized: port([], (n) => basisOf(basisOrthonormalized(n))),
  determinant: port([], (n) => real(basisDeterminantOf(n))),
  rotated: port(['VECTOR3', 'float'], (n, args) => basisOf(rotated(n, vectorAt(args, 0), args[1] as number))),
  scaled: port(['VECTOR3'], (n, args) => {
    const { x, y, z } = vectorAt(args, 0);
    return basisOf(basisScale([...n] as MutableBasis, x, y, z));
  }),
  scaled_local: port(['VECTOR3'], (n, args) => basisOf(scaledLocal(n, vectorAt(args, 0)))),
  get_scale: port([], (n) => vectorOf(vector(basisGetScale(n)))),
  get_euler: port(['EulerOrder'], (n, args) => vectorOf(basisGetEuler(n, args[0] as number))),
  tdotx: port(['VECTOR3'], (n, args) => real(columnDot(n, 0, vectorAt(args, 0)))),
  tdoty: port(['VECTOR3'], (n, args) => real(columnDot(n, 1, vectorAt(args, 0)))),
  tdotz: port(['VECTOR3'], (n, args) => real(columnDot(n, 2, vectorAt(args, 0)))),
  slerp: port(['BASIS', 'float'], (n, args) => basisOf(slerp(n, basisAt(args, 0), args[1] as number))),
  is_conformal: port([], (n) => bool(isConformal(n))),
  is_equal_approx: port(['BASIS'], (n, args) => {
    const other = basisAt(args, 0);
    return bool(n.every((component, index) => isEqualApproxf(component, other[index]!)));
  }),
  is_finite: port([], (n) => bool(n.every(Number.isFinite))),
  get_rotation_quaternion: port([], (n) => variant('QUATERNION', basisGetRotationQuaternion(n))),
  looking_at: methodPort(['VECTOR3', 'VECTOR3', 'bool'], (_base, args) =>
    basisOf(lookingAt(vectorAt(args, 0), vectorAt(args, 1), args[2] as boolean))
  ),
  from_scale: methodPort(['VECTOR3'], (_base, args) => {
    const { x, y, z } = vectorAt(args, 0);
    return basisOf([x, 0, 0, 0, y, 0, 0, 0, z]);
  }),
  from_euler: methodPort(['VECTOR3', 'EulerOrder'], (_base, args) =>
    basisOf(basisFromEuler(vectorAt(args, 0), args[1] as number))
  ),
};
