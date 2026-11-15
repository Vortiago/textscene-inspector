import type { Aabb } from '../../math/aabb.js';
import { basisMultiply, type BasisComponents } from '../../math/basis.js';
import { basisXform } from '../../math/basisFloat.js';
import type { Plane } from '../../math/plane.js';
import { storedReal as f } from '../../math/real.js';
import type { Rect2 } from '../../math/rect2.js';
import { multiplyTransform2D, transform2DXform, type Transform2DColumns } from '../../math/transform2d.js';
import { multiplyTransform3D, transform3DXform, type Transform3D } from '../../math/transform3d.js';
import { divideInt64, doubleToInt64, int64ToFloat32, remainderInt64, wrapInt64 } from '../cInteger.js';
import {
  variant,
  type Variant,
  type VariantTypeName,
  type Vector2Value,
  type Vector3Value,
} from '../value/variant.js';
import {
  anyComponentZero,
  COMPONENT_VECTORS,
  componentsOf,
  componentwise,
  negateComponents,
  remainderByScalar,
  remainderComponents,
  toRealVector,
  type ComponentVector,
} from './componentVectors.js';
import * as m from './matrices.js';

type Components = Readonly<Record<string, number>>;
type Binary = 'add' | 'subtract' | 'multiply' | 'divide';

const isScalar = (value: Variant) => value.type === 'INT' || value.type === 'FLOAT';

/** A scalar operand as the `real_t` parameter of a member operator takes it. */
const realOf = (scalar: Variant) =>
  scalar.type === 'INT' ? int64ToFloat32(scalar.value) : f(scalar.value as number);

const make = (type: VariantTypeName, value: unknown) => variant(type, value as never) as Variant;

function scalarBinary(operation: Binary, a: Variant, b: Variant): Variant {
  if (a.type === 'INT' && b.type === 'INT') {
    if (operation === 'divide') return make('INT', divideInt64(a.value, b.value));
    const result = { add: a.value + b.value, subtract: a.value - b.value, multiply: a.value * b.value }[
      operation
    ];
    return make('INT', wrapInt64(result));
  }
  const x = Number(a.value);
  const y = Number(b.value);
  return make('FLOAT', { add: x + y, subtract: x - y, multiply: x * y, divide: x / y }[operation]);
}

// variant_op.cpp:50: an int vector meets a float as the real vector of its components.
function realVectorOf(value: Variant): { type: VariantTypeName; vector: ComponentVector; value: Components } {
  const vector = COMPONENT_VECTORS[value.type]!;
  if (!vector.realType) return { type: value.type, vector, value: value.value as Components };
  return {
    type: vector.realType,
    vector: COMPONENT_VECTORS[vector.realType]!,
    value: toRealVector(value.value as Components),
  };
}

function vectorByScalar(operation: Binary, vectorValue: Variant, scalar: Variant): Variant {
  const target =
    scalar.type === 'FLOAT'
      ? realVectorOf(vectorValue)
      : {
          type: vectorValue.type,
          vector: COMPONENT_VECTORS[vectorValue.type]!,
          value: vectorValue.value as Components,
        };
  const { elements } = target.vector;
  const s = elements.scalar(scalar);
  // Quaternion::operator/ multiplies by `1 / p_s` (quaternion.h:225).
  if (operation === 'divide' && target.type === 'QUATERNION')
    return make(
      target.type,
      componentsOf(target.vector, target.value, (c) => elements.multiply(c, f(1 / s)))
    );
  return make(
    target.type,
    componentsOf(target.vector, target.value, (c) => elements[operation](c, s))
  );
}

function matrixByScalar(
  operation: 'multiply' | 'divide',
  matrix: Variant,
  scalar: number
): Variant | undefined {
  const isMultiply = operation === 'multiply';
  switch (matrix.type) {
    case 'TRANSFORM2D':
      return make(
        matrix.type,
        isMultiply ? m.scaleTransform2D(matrix.value, scalar) : m.divideTransform2D(matrix.value, scalar)
      );
    case 'BASIS':
      return make(
        matrix.type,
        isMultiply ? m.scaleBasis(matrix.value, scalar) : m.divideBasis(matrix.value, scalar)
      );
    case 'TRANSFORM3D':
      return make(
        matrix.type,
        isMultiply ? m.scaleTransform3D(matrix.value, scalar) : m.divideTransform3D(matrix.value, scalar)
      );
    default:
      return undefined;
  }
}

function matrixProduct(a: Variant, b: Variant): Variant | undefined {
  switch (a.type) {
    case 'TRANSFORM2D':
      return make(a.type, multiplyTransform2D(a.value, b.value as Transform2DColumns));
    case 'BASIS':
      return make(a.type, basisMultiply(a.value, b.value as BasisComponents));
    case 'TRANSFORM3D':
      return make(a.type, multiplyTransform3D(a.value, b.value as Transform3D));
    case 'PROJECTION':
      return make(a.type, m.multiplyProjection(a.value, b.value as typeof a.value));
    case 'QUATERNION':
      return make(a.type, m.multiplyQuaternion(a.value, b.value as typeof a.value));
    default:
      return undefined;
  }
}

/** `a op b` with the C++ operator of the two operand types. A free `scalar * x` is `x * scalar`. */
export function binaryArithmetic(operation: Binary, a: Variant, b: Variant): Variant {
  if (isScalar(a) && isScalar(b)) return scalarBinary(operation, a, b);
  if (isScalar(a) && operation === 'multiply') return binaryArithmetic(operation, b, a);
  if (isScalar(b)) {
    if (COMPONENT_VECTORS[a.type]) return vectorByScalar(operation, a, b);
    const result = matrixByScalar(operation as 'multiply' | 'divide', a, realOf(b));
    if (result) return result;
  }
  if (operation === 'multiply') {
    const product = matrixProduct(a, b);
    if (product) return product;
  }
  const vector = COMPONENT_VECTORS[a.type];
  if (!vector) throw new Error(`expected a type with operator ${operation}, got ${a.type} and ${b.type}`);
  return make(
    a.type,
    componentwise(vector, a.value as Components, b.value as Components, vector.elements[operation])
  );
}

const isZeroScalar = (value: Variant) => value.value === 0 || value.value === 0n;

/** DivNZ: "Division by zero error" for a zero divisor or any zero component of an int vector. */
export function divideNonZero(a: Variant, b: Variant): Variant | undefined {
  const vector = COMPONENT_VECTORS[b.type];
  if (vector ? anyComponentZero(vector, b.value as Components) : isZeroScalar(b)) return undefined;
  return binaryArithmetic('divide', a, b);
}

/** ModNZ: "Modulo by zero error" the same way, then C's `%`. */
export function moduloNonZero(a: Variant, b: Variant): Variant | undefined {
  const bVector = COMPONENT_VECTORS[b.type];
  if (bVector ? anyComponentZero(bVector, b.value as Components) : isZeroScalar(b)) return undefined;
  if (a.type === 'INT') return make('INT', remainderInt64(a.value, b.value as bigint));
  const vector = COMPONENT_VECTORS[a.type]!;
  if (bVector) return make(a.type, remainderComponents(vector, a.value as Components, b.value as Components));
  return make(a.type, remainderByScalar(vector, a.value as Components, vector.elements.scalar(b)));
}

export function negate(a: Variant): Variant {
  if (a.type === 'INT') return make('INT', wrapInt64(-a.value));
  if (a.type === 'FLOAT') return make('FLOAT', -a.value);
  if (a.type === 'PLANE') {
    const { normal, d } = a.value;
    return make('PLANE', { normal: { x: -normal.x, y: -normal.y, z: -normal.z }, d: -d });
  }
  return make(a.type, negateComponents(a.type, COMPONENT_VECTORS[a.type]!, a.value as Components));
}

/** `R(Math::pow((double)a, (double)b))`, the int result cast as x86-64 casts. */
export function power(resultType: VariantTypeName, a: Variant, b: Variant): Variant {
  const result = Math.pow(Number(a.value), Number(b.value));
  return resultType === 'INT' ? make('INT', doubleToInt64(result)) : make('FLOAT', result);
}

// DEBUG_ENABLED refuses a negative operand, and x86-64 masks the count to six bits.
export function shift(direction: 'left' | 'right', a: bigint, b: bigint): Variant | undefined {
  if (a < 0n || b < 0n) return undefined;
  const count = b & 63n;
  return make('INT', direction === 'left' ? wrapInt64(a << count) : a >> count);
}

/** `a.xform(b)`: the transform on the left carries the value on the right. */
export function xform(a: Variant, b: Variant): Variant {
  switch (a.type) {
    case 'TRANSFORM2D':
      if (b.type === 'VECTOR2') return make(b.type, transform2DXform(a.value, b.value));
      if (b.type === 'RECT2') return make(b.type, m.transform2DXformRect(a.value, b.value));
      return make(
        b.type,
        (b.value as readonly Vector2Value[]).map((point) => transform2DXform(a.value, point))
      );
    case 'TRANSFORM3D':
      if (b.type === 'VECTOR3') return make(b.type, transform3DXform(a.value, b.value));
      if (b.type === 'AABB') return make(b.type, m.transform3DXformAabb(a.value, b.value));
      if (b.type === 'PLANE') return make(b.type, m.transform3DXformPlane(a.value, b.value));
      return make(
        b.type,
        (b.value as readonly Vector3Value[]).map((point) => transform3DXform(a.value, point))
      );
    case 'BASIS':
      return make(b.type, basisXform(a.value, b.value as Vector3Value));
    case 'QUATERNION':
      return make(b.type, m.quaternionXform(a.value, b.value as Vector3Value));
    case 'PROJECTION':
      return make(b.type, m.projectionXform(a.value, b.value as (typeof a.value)[0]));
    default:
      throw new Error(`expected a transform, got ${a.type}`);
  }
}

/** `b.xform_inv(a)`: the value on the left goes back through the transform on the right. */
export function xformInverse(a: Variant, b: Variant): Variant {
  switch (b.type) {
    case 'TRANSFORM2D':
      if (a.type === 'VECTOR2') return make(a.type, m.transform2DXformInv(b.value, a.value));
      if (a.type === 'RECT2') return make(a.type, m.transform2DXformInvRect(b.value, a.value as Rect2));
      return make(
        a.type,
        (a.value as readonly Vector2Value[]).map((point) => m.transform2DXformInv(b.value, point))
      );
    case 'TRANSFORM3D':
      if (a.type === 'VECTOR3') return make(a.type, m.transform3DXformInvVector(b.value, a.value));
      if (a.type === 'AABB') return make(a.type, m.transform3DXformInvAabb(b.value, a.value as Aabb));
      if (a.type === 'PLANE') return make(a.type, m.transform3DXformInvPlane(b.value, a.value as Plane));
      return make(
        a.type,
        (a.value as readonly Vector3Value[]).map((point) => m.transform3DXformInvVector(b.value, point))
      );
    case 'BASIS':
      return make(a.type, m.basisXformInvVector(b.value, a.value as Vector3Value));
    case 'QUATERNION':
      return make(a.type, m.quaternionXformInv(b.value, a.value as Vector3Value));
    case 'PROJECTION':
      return make(a.type, m.projectionXformInv(b.value, a.value as (typeof b.value)[0]));
    default:
      throw new Error(`expected a transform, got ${b.type}`);
  }
}

export function bitwise(operation: 'and' | 'or' | 'xor', a: bigint, b: bigint): Variant {
  return make('INT', { and: a & b, or: a | b, xor: a ^ b }[operation]);
}
