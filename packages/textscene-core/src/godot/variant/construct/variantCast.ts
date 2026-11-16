import { basisFromQuaternion, basisGetQuaternion, type BasisComponents } from '../../math/basis.js';
import { htmlColor, namedColor } from '../../math/color.js';
import { storedReal as f } from '../../math/real.js';
import { basisOfTransform3D, transform3DOf, type Transform3D } from '../../math/transform3d.js';
import { EMPTY_NODE_PATH, nodePathParts } from '../../string/nodePathParts.js';
import { stringToInt64 } from '../../string/string.js';
import { stringToFloat } from '../../string/strtod.js';
import { doubleToInt32, doubleToInt64, wrapInt32 } from '../cInteger.js';
import { booleanize } from '../compare.js';
import { STRICT_CONVERSIONS } from '../registrations.generated.js';
import { stringify } from '../stringify.js';
import { defaultValue } from '../value/defaultValue.js';
import { variant, type ColorValue, type Variant, type VariantTypeName } from '../value/variant.js';
import {
  isPackedType,
  PACKED_ELEMENTS,
  packedElements,
  type PackedElement,
  type PackedTypeName,
} from '../value/packedElements.js';
import { castTo } from '../utility/utilityArguments.js';
import {
  componentsOf as structComponents,
  isVectorType,
  MATH_LAYOUT,
  structOf,
  type StructVariant,
  type VectorTypeName,
} from '../value/mathLayout.js';

export type Components = Readonly<Record<string, number>>;

/** `Variant::can_convert_strict` (variant.cpp:535). */
export function canConvertStrict(from: VariantTypeName, to: VariantTypeName): boolean {
  if (from === to || to === 'NIL') return true;
  if (from === 'NIL') return to === 'OBJECT';
  return STRICT_CONVERSIONS[to]?.includes(from) ?? false;
}

/** Each named component of a vector, rectangle or colour, through `map`. */
const mapComponents = (value: unknown, map: (component: number) => number): Components =>
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

/** `_to_int<int32_t>`: a double through the int32 cast, every other source through its int64 bits. */
export function toInt32(value: Variant): number {
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

/** Each element converted as `Packed*Array(Array)` converts it (variant.cpp:2240), through its `T`. */
function packedFromArray(type: PackedTypeName, elements: readonly Variant[]): unknown[] {
  const element = PACKED_ELEMENTS[type] as PackedElement<unknown>;
  return elements.map((value) => element.stored(castTo(value, element.parameter)));
}

// `Variant::operator Vector3()` and its kin (variant.cpp:1751): the leading components, then zeros.
function castVector(value: StructVariant, type: VectorTypeName): unknown {
  const source = structComponents(value);
  const { component, count } = MATH_LAYOUT[type];
  const toComponent = component === 'int32' ? doubleToInt32 : f;
  return structOf(
    type,
    Array.from({ length: count }, (_, index) => toComponent(source[index] ?? 0))
  ).value;
}

// `_convert_array_from_variant` (variant.cpp:2094): the elements of an Array or a packed array, else none.
function elementsOf(value: Variant): readonly Variant[] {
  if (value.type === 'ARRAY') return value.value;
  return isPackedType(value.type) ? packedElements(value) : [];
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
      return isVectorType(value.type) ? castVector(value as StructVariant, type) : undefined;
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
      return isPackedType(type) ? packedFromArray(type, elementsOf(value)) : undefined;
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
