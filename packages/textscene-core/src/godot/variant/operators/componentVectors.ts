import { storedReal as f } from '../../math/real.js';
import { divideInt32, int64ToFloat32, remainderInt32, wrapInt32 } from '../cInteger.js';
import type { Variant, VariantTypeName } from '../value/variant.js';

type Components = Readonly<Record<string, number>>;

/** The element arithmetic of one vector type: `real_t`, `float` or `int32_t`. */
interface ElementArithmetic {
  readonly add: (a: number, b: number) => number;
  readonly subtract: (a: number, b: number) => number;
  readonly multiply: (a: number, b: number) => number;
  readonly divide: (a: number, b: number) => number;
  readonly negate: (a: number) => number;
  /** The scalar operand converted to the element type, as the member operator's parameter takes it. */
  readonly scalar: (scalar: Variant) => number;
}

const FLOAT_ELEMENTS: ElementArithmetic = {
  add: (a, b) => f(a + b),
  subtract: (a, b) => f(a - b),
  multiply: (a, b) => f(a * b),
  divide: (a, b) => f(a / b),
  negate: (a) => -a,
  scalar: (scalar) => (scalar.type === 'INT' ? int64ToFloat32(scalar.value) : f(Number(scalar.value))),
};

const INT32_ELEMENTS: ElementArithmetic = {
  add: (a, b) => (a + b) | 0,
  subtract: (a, b) => (a - b) | 0,
  multiply: Math.imul,
  divide: divideInt32,
  negate: (a) => -a | 0,
  scalar: (scalar) => wrapInt32(scalar.value as bigint),
};

export interface ComponentVector {
  readonly keys: readonly string[];
  readonly elements: ElementArithmetic;
  /** The real vector an int vector becomes before an operator with a float (variant_op.cpp:50). */
  readonly realType?: VariantTypeName;
}

const XY = ['x', 'y'];
const XYZ = ['x', 'y', 'z'];
const XYZW = ['x', 'y', 'z', 'w'];

export const COMPONENT_VECTORS: Readonly<Partial<Record<VariantTypeName, ComponentVector>>> = {
  VECTOR2: { keys: XY, elements: FLOAT_ELEMENTS },
  VECTOR3: { keys: XYZ, elements: FLOAT_ELEMENTS },
  VECTOR4: { keys: XYZW, elements: FLOAT_ELEMENTS },
  QUATERNION: { keys: XYZW, elements: FLOAT_ELEMENTS },
  COLOR: { keys: ['r', 'g', 'b', 'a'], elements: FLOAT_ELEMENTS },
  VECTOR2I: { keys: XY, elements: INT32_ELEMENTS, realType: 'VECTOR2' },
  VECTOR3I: { keys: XYZ, elements: INT32_ELEMENTS, realType: 'VECTOR3' },
  VECTOR4I: { keys: XYZW, elements: INT32_ELEMENTS, realType: 'VECTOR4' },
};

export function componentsOf(vector: ComponentVector, value: Components, map: (component: number) => number) {
  return Object.fromEntries(vector.keys.map((key) => [key, map(value[key]!)]));
}

export function componentwise(
  vector: ComponentVector,
  a: Components,
  b: Components,
  operate: (a: number, b: number) => number
): Components {
  return Object.fromEntries(vector.keys.map((key) => [key, operate(a[key]!, b[key]!)]));
}

export function anyComponentZero(vector: ComponentVector, value: Components): boolean {
  return vector.keys.some((key) => value[key] === 0);
}

/** `Vector2(int x, int y)` and its kin: each int32 component as the real it converts to. */
export function toRealVector(value: Components): Components {
  return Object.fromEntries(Object.entries(value).map(([key, component]) => [key, f(component)]));
}

// Color's unary minus is its inverse (color.h:379), and Quaternion has no componentwise product.
export function negateComponents(
  type: VariantTypeName,
  vector: ComponentVector,
  value: Components
): Components {
  if (type === 'COLOR') return componentsOf(vector, value, (component) => f(1 - component));
  return componentsOf(vector, value, vector.elements.negate);
}

export function remainderComponents(vector: ComponentVector, a: Components, b: Components): Components {
  return componentwise(vector, a, b, remainderInt32);
}

export function remainderByScalar(vector: ComponentVector, a: Components, scalar: number): Components {
  return componentsOf(vector, a, (component) => remainderInt32(component, scalar));
}

// The comparison operators test each component with ==, and the last one with the operator itself.
function lexicographic(
  vector: ComponentVector,
  a: Components,
  b: Components,
  earlier: (a: number, b: number) => boolean,
  last: (a: number, b: number) => boolean
): boolean {
  const lastIndex = vector.keys.length - 1;
  for (let index = 0; index < lastIndex; index += 1) {
    const key = vector.keys[index]!;
    if (a[key] !== b[key]) return earlier(a[key]!, b[key]!);
  }
  const key = vector.keys[lastIndex]!;
  return last(a[key]!, b[key]!);
}

const less = (a: number, b: number) => a < b;
const greater = (a: number, b: number) => a > b;

export const VECTOR_ORDER = {
  OP_LESS: (vector: ComponentVector, a: Components, b: Components) => lexicographic(vector, a, b, less, less),
  OP_LESS_EQUAL: (vector: ComponentVector, a: Components, b: Components) =>
    lexicographic(vector, a, b, less, (x, y) => x <= y),
  OP_GREATER: (vector: ComponentVector, a: Components, b: Components) =>
    lexicographic(vector, a, b, greater, greater),
  OP_GREATER_EQUAL: (vector: ComponentVector, a: Components, b: Components) =>
    lexicographic(vector, a, b, greater, (x, y) => x >= y),
};

export function componentsEqual(vector: ComponentVector, a: Components, b: Components): boolean {
  return vector.keys.every((key) => a[key] === b[key]);
}
