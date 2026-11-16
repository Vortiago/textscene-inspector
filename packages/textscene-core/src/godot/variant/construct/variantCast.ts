import { basisFromQuaternion, basisGetQuaternion, type BasisComponents } from '../../math/basis.js';
import { htmlColor, namedColor } from '../../math/color.js';
import { storedReal as f } from '../../math/real.js';
import { basisOfTransform3D, transform3DOf, type Transform3D } from '../../math/transform3d.js';
import { EMPTY_NODE_PATH, nodePathParts } from '../../string/nodePathParts.js';
import { stringToInt64 } from '../../string/string.js';
import { stringToFloat } from '../../string/strtod.js';
import { doubleToInt32, doubleToInt64, int64ToFloat32, wrapInt32 } from '../cInteger.js';
import { booleanize } from '../compare.js';
import { STRICT_CONVERSIONS } from '../registrations.generated.js';
import { stringify } from '../stringify.js';
import { defaultValue } from '../value/defaultValue.js';
import { variant, type ColorValue, type Variant, type VariantTypeName } from '../value/variant.js';

export type Components = Readonly<Record<string, number>>;

/** `Variant::can_convert_strict` (variant.cpp:535). */
export function canConvertStrict(from: VariantTypeName, to: VariantTypeName): boolean {
  if (from === to || to === 'NIL') return true;
  if (from === 'NIL') return to === 'OBJECT';
  return STRICT_CONVERSIONS[to]?.includes(from) ?? false;
}

/** Each named component of a vector, rectangle or colour, through `map`. */
export const mapComponents = (value: unknown, map: (component: number) => number): Components =>
  Object.fromEntries(Object.entries(value as Components).map(([key, component]) => [key, map(component)]));

/** `Color(const String &)` (color.h:274): an HTML code, else a named colour, else `Color()`. */
export function colorFromString(text: string): ColorValue {
  const color = htmlColor(text) ?? namedColor(text);
  if (!color) return { r: 0, g: 0, b: 0, a: 1 };
  return { r: f(color.r), g: f(color.g), b: f(color.b), a: f(color.a) };
}

// Color::hex (color.cpp:284) of the int as an unsigned 32-bit pattern.
function colorFromHex(value: number): ColorValue {
  const byte = (shift: number) => f(((value >>> shift) & 0xff) / 255);
  return { r: byte(24), g: byte(16), b: byte(8), a: byte(0) };
}

const PACKED_ELEMENT_TYPE: Readonly<Partial<Record<VariantTypeName, VariantTypeName>>> = {
  PACKED_BYTE_ARRAY: 'INT',
  PACKED_INT32_ARRAY: 'INT',
  PACKED_INT64_ARRAY: 'INT',
  PACKED_FLOAT32_ARRAY: 'FLOAT',
  PACKED_FLOAT64_ARRAY: 'FLOAT',
  PACKED_STRING_ARRAY: 'STRING',
  PACKED_VECTOR2_ARRAY: 'VECTOR2',
  PACKED_VECTOR3_ARRAY: 'VECTOR3',
  PACKED_COLOR_ARRAY: 'COLOR',
  PACKED_VECTOR4_ARRAY: 'VECTOR4',
};

/** The element a packed array holds as a Variant: its ints as INT and its floats as FLOAT. */
export function packedElements(packed: Variant): Variant[] {
  const type = PACKED_ELEMENT_TYPE[packed.type]!;
  return (packed.value as readonly unknown[]).map((element) =>
    type === 'INT' && typeof element === 'number'
      ? variant('INT', BigInt(element))
      : (variant(type, element as never) as Variant)
  );
}

// _to_int<T> and _to_float<T> (variant.h:361): Nil is 0, a String reads its text, and other types 0.
function toInt64(value: Variant): bigint {
  switch (value.type) {
    case 'BOOL':
      return value.value ? 1n : 0n;
    case 'INT':
      return value.value;
    case 'FLOAT':
      return doubleToInt64(value.value);
    case 'STRING':
      return stringToInt64(value.value);
    default:
      return 0n;
  }
}

function toInt32(value: Variant): number {
  return value.type === 'FLOAT' ? doubleToInt32(value.value) : wrapInt32(toInt64(value));
}

/** `Variant::operator double()`: a source type it does not take gives 0. */
export function toDouble(value: Variant): number {
  switch (value.type) {
    case 'BOOL':
      return value.value ? 1 : 0;
    case 'INT':
      return Number(value.value);
    case 'FLOAT':
      return value.value;
    case 'STRING':
      return stringToFloat(value.value);
    default:
      return 0;
  }
}

/** Each element converted as `Packed*Array(Array)` converts it (variant.cpp:2240). */
function packedFromArray(type: VariantTypeName, elements: readonly Variant[]): unknown[] {
  switch (type) {
    case 'PACKED_BYTE_ARRAY':
      return elements.map((element) => toInt32(element) & 0xff);
    case 'PACKED_INT32_ARRAY':
      return elements.map(toInt32);
    case 'PACKED_INT64_ARRAY':
      return elements.map(toInt64);
    case 'PACKED_FLOAT32_ARRAY':
      return elements.map((element) =>
        element.type === 'INT' ? int64ToFloat32(element.value) : f(toDouble(element))
      );
    case 'PACKED_FLOAT64_ARRAY':
      return elements.map(toDouble);
    case 'PACKED_STRING_ARRAY':
      return elements.map(stringify);
    default: {
      const elementType = PACKED_ELEMENT_TYPE[type]!;
      return elements.map((element) => castVariant(element, elementType).value);
    }
  }
}

const VECTOR_AXES = ['x', 'y', 'z', 'w'] as const;
const VECTOR_SIZE: Readonly<Partial<Record<VariantTypeName, number>>> = {
  VECTOR2: 2,
  VECTOR2I: 2,
  VECTOR3: 3,
  VECTOR3I: 3,
  VECTOR4: 4,
  VECTOR4I: 4,
};

// `Variant::operator Vector3()` and its kin (variant.cpp:1751): the leading components, then zeros.
function castVector(value: Variant, type: VariantTypeName): Components {
  const source = value.value as Components;
  const toComponent = type.endsWith('I') ? doubleToInt32 : f;
  const axes = VECTOR_AXES.slice(0, VECTOR_SIZE[type]);
  return Object.fromEntries(axes.map((axis) => [axis, toComponent(source[axis] ?? 0)]));
}

// `_convert_array_from_variant` (variant.cpp:2094): the elements of an Array or a packed array, else none.
function elementsOf(value: Variant): readonly Variant[] {
  if (value.type === 'ARRAY') return value.value;
  return PACKED_ELEMENT_TYPE[value.type] ? packedElements(value) : [];
}

/** `Variant::operator T()`: a source type the operator does not take gives the default of `type`. */
export function castVariant(value: Variant, type: VariantTypeName): Variant {
  if (value.type === type) return value;
  const converted = convertedValue(value, type);
  return converted === undefined ? defaultValue(type) : (variant(type, converted as never) as Variant);
}

// Nothing for a source the operator does not take (variant.cpp:1658 onwards).
function convertedValue(value: Variant, type: VariantTypeName): unknown {
  switch (type) {
    case 'BOOL':
      return booleanize(value);
    case 'INT':
      return toInt64(value);
    case 'FLOAT':
      return toDouble(value);
    case 'STRING':
      return stringify(value);
    case 'STRING_NAME':
      return value.type === 'STRING' ? value.value : undefined;
    case 'NODE_PATH':
      return value.type === 'STRING' ? (nodePathParts(value.value) ?? EMPTY_NODE_PATH) : undefined;
    case 'VECTOR2':
    case 'VECTOR3':
    case 'VECTOR4':
    case 'VECTOR2I':
    case 'VECTOR3I':
    case 'VECTOR4I':
      return VECTOR_SIZE[value.type] ? castVector(value, type) : undefined;
    case 'RECT2':
      return value.type === 'RECT2I' ? mapComponents(value.value, f) : undefined;
    case 'RECT2I':
      return value.type === 'RECT2' ? mapComponents(value.value, doubleToInt32) : undefined;
    case 'TRANSFORM2D':
      return value.type === 'TRANSFORM3D' ? transform2DOf(value.value) : undefined;
    case 'TRANSFORM3D':
      return transform3DFrom(value);
    case 'BASIS':
      return basisFrom(value);
    case 'QUATERNION': {
      const basis = basisFrom(value);
      return basis && basisGetQuaternion(basis);
    }
    case 'PROJECTION': {
      const transform = transform3DFrom(value);
      return transform && projectionOf(transform);
    }
    case 'COLOR':
      if (value.type === 'STRING') return colorFromString(value.value);
      return value.type === 'INT' ? colorFromHex(toInt32(value)) : undefined;
    case 'ARRAY':
      return elementsOf(value);
    default:
      return PACKED_ELEMENT_TYPE[type] ? packedFromArray(type, elementsOf(value)) : undefined;
  }
}

function transform2DOf({ basis_x: x, basis_y: y, origin }: Transform3D) {
  return { a: x.x, b: y.x, c: x.y, d: y.y, tx: origin.x, ty: origin.y };
}

function basisFrom(value: Variant): BasisComponents | undefined {
  if (value.type === 'BASIS') return value.value;
  if (value.type === 'QUATERNION') return basisFromQuaternion(value.value);
  return value.type === 'TRANSFORM3D' ? basisOfTransform3D(value.value) : undefined;
}

function transform3DFrom(value: Variant): Transform3D | undefined {
  switch (value.type) {
    case 'TRANSFORM3D':
      return value.value;
    case 'TRANSFORM2D': {
      const { a, b, c, d, tx, ty } = value.value;
      return {
        basis_x: { x: a, y: c, z: 0 },
        basis_y: { x: b, y: d, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin: { x: tx, y: ty, z: 0 },
      };
    }
    case 'BASIS':
    case 'QUATERNION':
      return transform3DOf(basisFrom(value)!, { x: 0, y: 0, z: 0 });
    case 'PROJECTION': {
      const [x, y, z, w] = value.value;
      return {
        basis_x: { x: x.x, y: y.x, z: z.x },
        basis_y: { x: x.y, y: y.y, z: z.y },
        basis_z: { x: x.z, y: y.z, z: z.z },
        origin: { x: w.x, y: w.y, z: w.z },
      };
    }
    default:
      return undefined;
  }
}

// Projection(const Transform3D &) (projection.cpp:960): the basis columns, then the origin.
function projectionOf({ basis_x: x, basis_y: y, basis_z: z, origin }: Transform3D) {
  return [
    { x: x.x, y: y.x, z: z.x, w: 0 },
    { x: x.y, y: y.y, z: z.y, w: 0 },
    { x: x.z, y: y.z, z: z.z, w: 0 },
    { x: origin.x, y: origin.y, z: origin.z, w: 1 },
  ];
}
