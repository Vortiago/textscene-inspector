import { basisFromQuaternion } from '../../math/basis.js';
import { htmlColor, namedColor } from '../../math/color.js';
import { storedReal as f } from '../../math/real.js';
import { nodePathText } from '../../string/nodePath.js';
import { stringToInt64 } from '../../string/string.js';
import { stringToFloat } from '../../string/strtod.js';
import { doubleToInt32, doubleToInt64, int64ToFloat32, wrapInt32 } from '../cInteger.js';
import { booleanize } from '../compare.js';
import { STRICT_CONVERSIONS } from '../registrations.generated.js';
import { stringify } from '../stringify.js';
import { defaultValue } from '../value/defaultValue.js';
import { variant, type ColorValue, type Variant, type VariantTypeName } from '../value/variant.js';
import { basisQuaternion } from './rotations.js';

type Components = Readonly<Record<string, number>>;

/** `Variant::can_convert_strict` (variant.cpp:535). */
export function canConvertStrict(from: VariantTypeName, to: VariantTypeName): boolean {
  if (from === to || to === 'NIL') return true;
  if (from === 'NIL') return to === 'OBJECT';
  return STRICT_CONVERSIONS[to]?.includes(from) ?? false;
}

const mapComponents = (value: unknown, map: (component: number) => number) =>
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

function toDouble(value: Variant): number {
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

/** A conversion this slice has not ported yet. */
export class UnportedConversion extends Error {}

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
      return elements.map((element) => castOrDefault(element, elementType).value);
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

// A packed element: another vector, a Color from a String or an int, else the default.
function castOrDefault(value: Variant, type: VariantTypeName): Variant {
  if (value.type === type) return value;
  const isColorSource = type === 'COLOR' && (value.type === 'STRING' || value.type === 'INT');
  if (isColorSource || (VECTOR_SIZE[type] && VECTOR_SIZE[value.type])) return castVariant(value, type);
  return defaultValue(type);
}

/** `value` converted to `type`, which `Variant::can_convert_strict` allows from its own type. */
export function castVariant(value: Variant, type: VariantTypeName): Variant {
  if (value.type === type) return value;
  const make = (result: unknown) => variant(type, result as never) as Variant;
  switch (type) {
    case 'BOOL':
      return make(booleanize(value));
    case 'INT':
      return make(toInt64(value));
    case 'FLOAT':
      return make(toDouble(value));
    case 'STRING':
      return make(stringify(value));
    case 'STRING_NAME':
      return make(value.value as string);
    case 'NODE_PATH':
      return make(nodePathText(value.value as string));
    case 'VECTOR2':
    case 'VECTOR3':
    case 'VECTOR4':
    case 'VECTOR2I':
    case 'VECTOR3I':
    case 'VECTOR4I':
      return make(castVector(value, type));
    case 'RECT2':
      return make(mapComponents(value.value, f));
    case 'RECT2I':
      return make(mapComponents(value.value, doubleToInt32));
    case 'TRANSFORM2D':
      return make(transform2DOf(value));
    case 'TRANSFORM3D':
      return make(transform3DOf(value));
    case 'BASIS':
      return make(basisFromQuaternion(value.value as never));
    case 'QUATERNION':
      return make(basisQuaternion(value.value as never));
    case 'PROJECTION':
      return make(projectionOf(value.value as never));
    case 'COLOR':
      return make(value.type === 'STRING' ? colorFromString(value.value) : colorFromHex(toInt32(value)));
    case 'RID':
    case 'OBJECT':
      return defaultValue(type);
    case 'ARRAY':
      return make(packedElements(value));
    default:
      if (value.type === 'ARRAY') return make(packedFromArray(type, value.value));
      throw new UnportedConversion(`${value.type} to ${type}`);
  }
}

function transform2DOf(value: Variant) {
  const {
    basis_x: x,
    basis_y: y,
    origin,
  } = value.value as unknown as {
    basis_x: Components;
    basis_y: Components;
    origin: Components;
  };
  return { a: x.x!, b: y.x!, c: x.y!, d: y.y!, tx: origin.x!, ty: origin.y! };
}

function transform3DOf(value: Variant) {
  switch (value.type) {
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
    case 'QUATERNION': {
      const n = value.type === 'BASIS' ? value.value : basisFromQuaternion(value.value);
      return {
        basis_x: { x: n[0], y: n[1], z: n[2] },
        basis_y: { x: n[3], y: n[4], z: n[5] },
        basis_z: { x: n[6], y: n[7], z: n[8] },
        origin: { x: 0, y: 0, z: 0 },
      };
    }
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
      throw new UnportedConversion(`${value.type} to TRANSFORM3D`);
  }
}

// Projection(const Transform3D &) (projection.cpp:960): the basis columns, then the origin.
function projectionOf(t: {
  basis_x: Components;
  basis_y: Components;
  basis_z: Components;
  origin: Components;
}) {
  const { basis_x: x, basis_y: y, basis_z: z, origin } = t;
  return [
    { x: x.x, y: y.x, z: z.x, w: 0 },
    { x: x.y, y: y.y, z: z.y, w: 0 },
    { x: x.z, y: y.z, z: z.z, w: 0 },
    { x: origin.x, y: origin.y, z: origin.z, w: 1 },
  ];
}
