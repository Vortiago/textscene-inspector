import { duplicateVariant } from '../duplicate.js';
import type { Aabb } from '../../math/aabb.js';
import {
  basisFromColumns,
  IDENTITY_BASIS,
  type BasisComponents,
  type MutableBasis,
} from '../../math/basis.js';
import { basisSetAxisAngle } from '../../math/basisFloat.js';
import { storedReal as f } from '../../math/real.js';
import { transform3DOf } from '../../math/transform3d.js';
import { transform2DFromParts, transform2DFromRotation } from '../../math/transform2d.js';
import { wrapInt32 } from '../cInteger.js';
import {
  variant,
  type ColorValue,
  type Variant,
  type VariantTypeName,
  type Vector2Value,
  type Vector3Value,
  type Vector4Value,
} from '../value/variant.js';
import {
  checkedQuaternionFromAxisAngle,
  planeFromNormalPoint,
  planeFromPoints,
  quaternionArc,
} from './rotations.js';
import { canConvertStrict, castVariant, colorFromString } from './variantCast.js';
import { MATH_LAYOUT, structOf, type MathTypeName } from '../value/mathLayout.js';

type Arguments = readonly Variant[];
type Build = (args: Arguments) => unknown;

// A `double` argument passed to a `real_t` parameter, and an `int64_t` one to an `int32_t` parameter.
const real = (args: Arguments, index: number) => f(args[index]!.value as number);
const int32 = (args: Arguments, index: number) => wrapInt32(args[index]!.value as bigint);
const v2 = (args: Arguments, index: number) => args[index]!.value as Vector2Value;
const v3 = (args: Arguments, index: number) => args[index]!.value as Vector3Value;
const v4 = (args: Arguments, index: number) => args[index]!.value as Vector4Value;

/** A math value built from one scalar argument for each component, in its struct's order. */
const fromScalars =
  (type: MathTypeName): Build =>
  (args) => {
    const component = MATH_LAYOUT[type].component === 'int32' ? int32 : real;
    return structOf(
      type,
      args.map((_, index) => component(args, index))
    ).value;
  };

function basisAxisAngle(args: Arguments): BasisComponents {
  return basisSetAxisAngle([...IDENTITY_BASIS] as MutableBasis, v3(args, 0), real(args, 1));
}

/** Keyed `TYPE(ARG, ...)` by Variant type names. A one-argument row of a strict conversion is its cast. */
const BUILDERS: Readonly<Record<string, Build>> = {
  'VECTOR2(FLOAT,FLOAT)': fromScalars('VECTOR2'),
  'VECTOR2I(INT,INT)': fromScalars('VECTOR2I'),
  'VECTOR3(FLOAT,FLOAT,FLOAT)': fromScalars('VECTOR3'),
  'VECTOR3I(INT,INT,INT)': fromScalars('VECTOR3I'),
  'VECTOR4(FLOAT,FLOAT,FLOAT,FLOAT)': fromScalars('VECTOR4'),
  'VECTOR4I(INT,INT,INT,INT)': fromScalars('VECTOR4I'),
  'RECT2(FLOAT,FLOAT,FLOAT,FLOAT)': fromScalars('RECT2'),
  'RECT2I(INT,INT,INT,INT)': fromScalars('RECT2I'),
  'RECT2(VECTOR2,VECTOR2)': rectOf,
  'RECT2I(VECTOR2I,VECTOR2I)': rectOf,
  'TRANSFORM2D(FLOAT,VECTOR2)': (args) => transform2DFromRotation(real(args, 0), v2(args, 1)),
  'TRANSFORM2D(FLOAT,VECTOR2,FLOAT,VECTOR2)': (args) =>
    transform2DFromParts(real(args, 0), v2(args, 1), real(args, 2), v2(args, 3)),
  'TRANSFORM2D(VECTOR2,VECTOR2,VECTOR2)': (args) => {
    const [x, y, origin] = [v2(args, 0), v2(args, 1), v2(args, 2)];
    return { a: x.x, b: x.y, c: y.x, d: y.y, tx: origin.x, ty: origin.y };
  },
  'PLANE(VECTOR3)': (args) => ({ normal: v3(args, 0), d: 0 }),
  'PLANE(VECTOR3,FLOAT)': (args) => ({ normal: v3(args, 0), d: real(args, 1) }),
  'PLANE(VECTOR3,VECTOR3)': (args) => planeFromNormalPoint(v3(args, 0), v3(args, 1)),
  'PLANE(VECTOR3,VECTOR3,VECTOR3)': (args) => planeFromPoints(v3(args, 0), v3(args, 1), v3(args, 2)),
  'PLANE(FLOAT,FLOAT,FLOAT,FLOAT)': fromScalars('PLANE'),
  'QUATERNION(FLOAT,FLOAT,FLOAT,FLOAT)': fromScalars('QUATERNION'),
  'QUATERNION(VECTOR3,FLOAT)': (args) => checkedQuaternionFromAxisAngle(v3(args, 0), real(args, 1)),
  'QUATERNION(VECTOR3,VECTOR3)': (args) => quaternionArc(v3(args, 0), v3(args, 1)),
  'AABB(VECTOR3,VECTOR3)': (args): Aabb => ({ position: { ...v3(args, 0) }, size: { ...v3(args, 1) } }),
  'BASIS(VECTOR3,FLOAT)': basisAxisAngle,
  'BASIS(VECTOR3,VECTOR3,VECTOR3)': (args) => basisFromColumns(v3(args, 0), v3(args, 1), v3(args, 2)),
  'TRANSFORM3D(BASIS,VECTOR3)': (args) => transform3DOf(args[0]!.value as BasisComponents, v3(args, 1)),
  'TRANSFORM3D(VECTOR3,VECTOR3,VECTOR3,VECTOR3)': (args) =>
    transform3DOf(basisFromColumns(v3(args, 0), v3(args, 1), v3(args, 2)), v3(args, 3)),
  'PROJECTION(VECTOR4,VECTOR4,VECTOR4,VECTOR4)': (args) => [
    v4(args, 0),
    v4(args, 1),
    v4(args, 2),
    v4(args, 3),
  ],
  'COLOR(COLOR,FLOAT)': (args) => ({ ...(args[0]!.value as ColorValue), a: real(args, 1) }),
  'COLOR(STRING,FLOAT)': (args) => ({ ...colorFromString(args[0]!.value as string), a: real(args, 1) }),
  'COLOR(FLOAT,FLOAT,FLOAT)': (args) => ({ r: real(args, 0), g: real(args, 1), b: real(args, 2), a: 1 }),
  'COLOR(FLOAT,FLOAT,FLOAT,FLOAT)': fromScalars('COLOR'),
};

function rectOf(args: Arguments) {
  const [position, size] = [v2(args, 0), v2(args, 1)];
  return { x: position.x, y: position.y, w: size.x, h: size.y };
}

/** `T(P...)`. Throws on a registration this has no builder for, so a new Godot row fails the tests. */
export function buildFromCast(
  type: VariantTypeName,
  argumentTypes: readonly VariantTypeName[],
  args: Arguments
): Variant {
  if (args.length !== 1 || !canConvertStrict(argumentTypes[0]!, type))
    return buildFromParts(type, argumentTypes, args);
  const cast = castVariant(args[0]!, type);
  // A Packed*Array of the same type is a new Vector, so a method on one leaves the other as it was.
  return cast === args[0] && type.startsWith('PACKED_') ? duplicateVariant(cast, false) : cast;
}

function buildFromParts(
  type: VariantTypeName,
  argumentTypes: readonly VariantTypeName[],
  args: Arguments
): Variant {
  const build = BUILDERS[`${type}(${argumentTypes.join(',')})`];
  if (!build) throw new Error(`expected a ported constructor, got ${type}(${argumentTypes.join(', ')})`);
  return variant(type, build(args) as never) as Variant;
}
