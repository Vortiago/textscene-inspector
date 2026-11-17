import { VARIANT_TYPE } from './variantType.js';
import {
  COMPONENT_COUNTS,
  PACKED_ELEMENT_TYPES,
  componentsOf,
  isComponentType,
  isPackedNumberType,
  packedElements,
  type ComponentType,
  type PackedNumberType,
  type VariantValue,
} from './variantValue.js';
import { stringToFloat } from '../string/string.js';
import { colorFromString } from '../math/color.js';
import { basisFromQuaternion, basisGetQuaternion, type BasisComponents } from '../math/basis.js';
import { stringify } from './variantStringify.js';

const T = VARIANT_TYPE;

/** The types a setter of each type takes as valid besides its own (`variant.cpp:549-813`). */
const STRICT_SOURCES: Readonly<Partial<Record<number, readonly number[]>>> = {
  [T.BOOL]: [T.INT, T.FLOAT],
  [T.INT]: [T.BOOL, T.FLOAT],
  [T.FLOAT]: [T.BOOL, T.INT],
  [T.STRING]: [T.NODE_PATH, T.STRING_NAME],
  [T.VECTOR2]: [T.VECTOR2I],
  [T.VECTOR2I]: [T.VECTOR2],
  [T.RECT2]: [T.RECT2I],
  [T.RECT2I]: [T.RECT2],
  [T.TRANSFORM2D]: [T.TRANSFORM3D],
  [T.VECTOR3]: [T.VECTOR3I],
  [T.VECTOR3I]: [T.VECTOR3],
  [T.VECTOR4]: [T.VECTOR4I],
  [T.VECTOR4I]: [T.VECTOR4],
  [T.QUATERNION]: [T.BASIS],
  [T.BASIS]: [T.QUATERNION],
  [T.TRANSFORM3D]: [T.TRANSFORM2D, T.QUATERNION, T.BASIS, T.PROJECTION],
  [T.PROJECTION]: [T.TRANSFORM3D],
  [T.COLOR]: [T.STRING, T.INT],
  [T.RID]: [T.OBJECT],
  [T.STRING_NAME]: [T.STRING],
  [T.NODE_PATH]: [T.STRING],
  [T.ARRAY]: [
    T.PACKED_BYTE_ARRAY,
    T.PACKED_INT32_ARRAY,
    T.PACKED_INT64_ARRAY,
    T.PACKED_FLOAT32_ARRAY,
    T.PACKED_FLOAT64_ARRAY,
    T.PACKED_STRING_ARRAY,
    T.PACKED_COLOR_ARRAY,
    T.PACKED_VECTOR2_ARRAY,
    T.PACKED_VECTOR3_ARRAY,
    T.PACKED_VECTOR4_ARRAY,
  ],
  [T.PACKED_BYTE_ARRAY]: [T.ARRAY],
  [T.PACKED_INT32_ARRAY]: [T.ARRAY],
  [T.PACKED_INT64_ARRAY]: [T.ARRAY],
  [T.PACKED_FLOAT32_ARRAY]: [T.ARRAY],
  [T.PACKED_FLOAT64_ARRAY]: [T.ARRAY],
  [T.PACKED_STRING_ARRAY]: [T.ARRAY],
  [T.PACKED_VECTOR2_ARRAY]: [T.ARRAY],
  [T.PACKED_VECTOR3_ARRAY]: [T.ARRAY],
  [T.PACKED_COLOR_ARRAY]: [T.ARRAY],
  [T.PACKED_VECTOR4_ARRAY]: [T.ARRAY],
};

/** `Variant::can_convert_strict`: whether a setter of type `to` reports a value of type `from` valid. */
export function canConvertStrict(from: number, to: number): boolean {
  if (from === to || to === T.NIL) return true;
  if (from === T.NIL) return to === T.OBJECT;
  return STRICT_SOURCES[to]?.includes(from) ?? false;
}

/** What each component type holds when default-constructed. */
const DEFAULT_COMPONENTS: Readonly<Record<ComponentType, readonly number[]>> = {
  [T.VECTOR2]: [0, 0],
  [T.VECTOR2I]: [0, 0],
  [T.RECT2]: [0, 0, 0, 0],
  [T.RECT2I]: [0, 0, 0, 0],
  [T.VECTOR3]: [0, 0, 0],
  [T.VECTOR3I]: [0, 0, 0],
  [T.TRANSFORM2D]: [1, 0, 0, 1, 0, 0],
  [T.VECTOR4]: [0, 0, 0, 0],
  [T.VECTOR4I]: [0, 0, 0, 0],
  [T.PLANE]: [0, 0, 0, 0],
  [T.QUATERNION]: [0, 0, 0, 1],
  [T.AABB]: [0, 0, 0, 0, 0, 0],
  [T.BASIS]: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  [T.TRANSFORM3D]: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  [T.PROJECTION]: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  [T.COLOR]: [0, 0, 0, 1],
};

/** The vector families whose members cast into each other component by component. */
const VECTORS: readonly ComponentType[] = [
  T.VECTOR2,
  T.VECTOR2I,
  T.VECTOR3,
  T.VECTOR3I,
  T.VECTOR4,
  T.VECTOR4I,
];
const INTEGER_TYPES: ReadonlySet<number> = new Set([T.VECTOR2I, T.VECTOR3I, T.VECTOR4I, T.RECT2I]);

/** `T(value)` of a real into an `int32_t` component, which truncates. */
function int32(value: number): number {
  return Number.isFinite(value) ? Number(BigInt.asIntN(32, BigInt(Math.trunc(value)))) : 0;
}

/** A real component as a `real_t` field stores it. */
function real(value: number): number {
  return Math.fround(value);
}

function componentsAs(type: ComponentType, values: readonly number[]): VariantValue {
  return { type, value: values.map(INTEGER_TYPES.has(type) ? int32 : real) };
}

/** `Transform3D(Basis, Vector3())` of the nine row-major components of a basis. */
function transformOfBasis(basis: readonly number[]): number[] {
  return [...basis, 0, 0, 0];
}

function basisOfQuaternion([x, y, z, w]: readonly number[]): readonly number[] {
  return basisFromQuaternion({ x: x!, y: y!, z: z!, w: w! });
}

/** The `Transform3D` a Transform2D casts to (`variant.cpp:1928-1937`). */
function transformOf2D([xx, xy, yx, yy, ox, oy]: readonly number[]): number[] {
  return [xx!, yx!, 0, xy!, yy!, 0, 0, 0, 1, ox!, oy!, 0];
}

/** `Projection::operator Transform3D` (`projection.cpp:937-958`). */
function transformOfProjection(m: readonly number[]): number[] {
  return [m[0]!, m[4]!, m[8]!, m[1]!, m[5]!, m[9]!, m[2]!, m[6]!, m[10]!, m[12]!, m[13]!, m[14]!];
}

/** `Projection(const Transform3D &)` (`projection.cpp:960-980`). */
function projectionOfTransform(t: readonly number[]): number[] {
  return [t[0]!, t[3]!, t[6]!, 0, t[1]!, t[4]!, t[7]!, 0, t[2]!, t[5]!, t[8]!, 0, t[9]!, t[10]!, t[11]!, 1];
}

/** `Variant::operator Transform3D` (`variant.cpp:1920-1942`), as the source's components. */
function transformComponents(value: VariantValue): readonly number[] | undefined {
  const components = componentsOf(value);
  if (!components) return undefined;
  switch (value.type) {
    case T.TRANSFORM3D:
      return components;
    case T.BASIS:
      return transformOfBasis(components);
    case T.QUATERNION:
      return transformOfBasis(basisOfQuaternion(components));
    case T.TRANSFORM2D:
      return transformOf2D(components);
    case T.PROJECTION:
      return transformOfProjection(components);
  }
  return undefined;
}

/** `Variant::operator T()` for the component types, or undefined where it answers `T()`. */
function castComponents(value: VariantValue, to: ComponentType): readonly number[] | undefined {
  const components = componentsOf(value);
  if (VECTORS.includes(to) && components && VECTORS.includes(value.type as ComponentType)) {
    const count = COMPONENT_COUNTS[to];
    return Array.from({ length: count }, (_, i) => components[i] ?? 0);
  }
  switch (to) {
    case T.RECT2:
    case T.RECT2I:
      return value.type === T.RECT2 || value.type === T.RECT2I ? components : undefined;
    case T.BASIS:
      if (value.type === T.BASIS) return components;
      if (value.type === T.QUATERNION) return basisOfQuaternion(components!);
      return value.type === T.TRANSFORM3D ? components!.slice(0, 9) : undefined;
    case T.QUATERNION: {
      if (value.type === T.QUATERNION) return components;
      const basis =
        value.type === T.BASIS || value.type === T.TRANSFORM3D ? components!.slice(0, 9) : undefined;
      if (!basis) return undefined;
      const { x, y, z, w } = basisGetQuaternion(basis as unknown as BasisComponents);
      return [x, y, z, w];
    }
    case T.TRANSFORM3D:
      return transformComponents(value);
    case T.PROJECTION: {
      if (value.type === T.PROJECTION) return components;
      const transform = transformComponents(value);
      return transform && projectionOfTransform(transform);
    }
    case T.TRANSFORM2D: {
      if (value.type === T.TRANSFORM2D) return components;
      if (value.type !== T.TRANSFORM3D) return undefined;
      const t = components!;
      return [t[0]!, t[3]!, t[1]!, t[4]!, t[9]!, t[10]!];
    }
    case T.COLOR:
      if (value.type === T.COLOR) return components;
      if (value.type === T.STRING) {
        const { r, g, b, a } = colorFromString(value.value);
        return [r, g, b, a];
      }
      return value.type === T.INT ? hexColor(value.value) : undefined;
  }
  return value.type === to ? components : undefined;
}

/** `Color::hex` of an `int` (`color.cpp:89-101`): 0xRRGGBBAA. */
function hexColor(value: number): number[] {
  const packed = int32(value) >>> 0;
  return [packed >>> 24, (packed >>> 16) & 0xff, (packed >>> 8) & 0xff, packed & 0xff].map((c) => c / 255);
}

/** `Variant::booleanize`: `!is_zero()`. */
function truthy(value: VariantValue): boolean {
  switch (value.type) {
    case T.NIL:
      return false;
    case T.BOOL:
      return value.value;
    case T.INT:
    case T.FLOAT:
    case T.RID:
      return value.value !== 0;
    case T.STRING:
    case T.STRING_NAME:
    case T.NODE_PATH:
      return value.value !== '';
    case T.OBJECT:
      return value.resource !== undefined || value.className !== undefined;
    case T.CALLABLE:
    case T.SIGNAL:
      return false;
    case T.ARRAY:
      return value.elements.length > 0;
    case T.DICTIONARY:
      return value.entries.length > 0;
  }
  const components = componentsOf(value);
  if (components) return components.some((c, i) => c !== DEFAULT_COMPONENTS[value.type as ComponentType][i]);
  return (value as { value: readonly unknown[] }).value.length > 0;
}

/** `_to_float` (`variant.h:380-396`). */
function toFloat(value: VariantValue): number {
  switch (value.type) {
    case T.BOOL:
      return value.value ? 1 : 0;
    case T.INT:
    case T.FLOAT:
      return value.value;
    case T.STRING:
      return stringToFloat(value.value);
  }
  return 0;
}

/** `_to_int` as `int64_t` (`variant.h:361-377`). `String::to_int` reads the leading integer of the text. */
function toInt(value: VariantValue): number {
  if (value.type === T.STRING) return Number(/^\s*[+-]?\d+/.exec(value.value)?.[0] ?? 0);
  const number = toFloat(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}

function elementsOf(value: VariantValue): readonly VariantValue[] | undefined {
  if (value.type === T.ARRAY) return value.elements;
  return isPackedNumberType(value.type) || value.type === T.PACKED_STRING_ARRAY
    ? packedElements(value)
    : undefined;
}

/** A packed array of `type` from Variants, each element cast as `Vector::set(i, Variant)` casts it. */
function packedOf(type: number, elements: readonly VariantValue[]): VariantValue {
  if (type === T.PACKED_STRING_ARRAY) return { type, value: elements.map(stringify) };
  const elementType = PACKED_ELEMENT_TYPES[type as PackedNumberType];
  const numbers = elements.flatMap((element) => {
    const cast = castVariant(element, elementType) as { value: number | readonly number[] };
    return typeof cast.value === 'number' ? [cast.value] : cast.value;
  });
  const narrowed =
    type === T.PACKED_BYTE_ARRAY
      ? numbers.map((n) => Number(BigInt.asUintN(8, BigInt(Math.trunc(n)))))
      : type === T.PACKED_INT32_ARRAY
        ? numbers.map(int32)
        : type === T.PACKED_FLOAT32_ARRAY
          ? numbers.map(real)
          : numbers;
  return { type, value: narrowed } as VariantValue;
}

/** `Variant::operator T()`: what a setter of type `to` receives. A Nil argument type takes any value. */
export function castVariant(value: VariantValue, to: number): VariantValue {
  if (value.type === to || to === T.NIL) return value;
  if (isComponentType(to)) return componentsAs(to, castComponents(value, to) ?? DEFAULT_COMPONENTS[to]);
  switch (to) {
    case T.BOOL:
      return { type: T.BOOL, value: truthy(value) };
    case T.INT:
      return { type: T.INT, value: toInt(value) };
    case T.FLOAT:
      return { type: T.FLOAT, value: toFloat(value) };
    case T.STRING:
      return { type: T.STRING, value: stringify(value) };
    case T.STRING_NAME:
    case T.NODE_PATH:
      return { type: to, value: value.type === T.STRING || value.type === T.STRING_NAME ? value.value : '' };
    case T.RID:
      return { type: T.RID, value: 0 };
    case T.OBJECT:
      return { type: T.OBJECT };
    case T.CALLABLE:
    case T.SIGNAL:
      return { type: to };
    case T.DICTIONARY:
      return { type: T.DICTIONARY, entries: [] };
    case T.ARRAY:
      return { type: T.ARRAY, elements: elementsOf(value) ?? [] };
  }
  return packedOf(to, elementsOf(value) ?? []);
}
