import { VARIANT_TYPE } from './variantType.js';

const T = VARIANT_TYPE;

/** The types whose value is a run of numbers, each spelt by its constructor in this order. */
export const COMPONENT_COUNTS = {
  [T.VECTOR2]: 2,
  [T.VECTOR2I]: 2,
  [T.RECT2]: 4,
  [T.RECT2I]: 4,
  [T.VECTOR3]: 3,
  [T.VECTOR3I]: 3,
  [T.TRANSFORM2D]: 6,
  [T.VECTOR4]: 4,
  [T.VECTOR4I]: 4,
  [T.PLANE]: 4,
  [T.QUATERNION]: 4,
  [T.AABB]: 6,
  [T.BASIS]: 9,
  [T.TRANSFORM3D]: 12,
  [T.PROJECTION]: 16,
  [T.COLOR]: 4,
} as const;

export type ComponentType = keyof typeof COMPONENT_COUNTS;

/** The packed arrays of numbers, with how many numbers make one element. */
const PACKED_NUMBER_STRIDES = {
  [T.PACKED_BYTE_ARRAY]: 1,
  [T.PACKED_INT32_ARRAY]: 1,
  [T.PACKED_INT64_ARRAY]: 1,
  [T.PACKED_FLOAT32_ARRAY]: 1,
  [T.PACKED_FLOAT64_ARRAY]: 1,
  [T.PACKED_VECTOR2_ARRAY]: 2,
  [T.PACKED_VECTOR3_ARRAY]: 3,
  [T.PACKED_COLOR_ARRAY]: 4,
  [T.PACKED_VECTOR4_ARRAY]: 4,
} as const;

export type PackedNumberType = keyof typeof PACKED_NUMBER_STRIDES;

/** The type of one element of each packed array of numbers. */
export const PACKED_ELEMENT_TYPES = {
  [T.PACKED_BYTE_ARRAY]: T.INT,
  [T.PACKED_INT32_ARRAY]: T.INT,
  [T.PACKED_INT64_ARRAY]: T.INT,
  [T.PACKED_FLOAT32_ARRAY]: T.FLOAT,
  [T.PACKED_FLOAT64_ARRAY]: T.FLOAT,
  [T.PACKED_VECTOR2_ARRAY]: T.VECTOR2,
  [T.PACKED_VECTOR3_ARRAY]: T.VECTOR3,
  [T.PACKED_COLOR_ARRAY]: T.COLOR,
  [T.PACKED_VECTOR4_ARRAY]: T.VECTOR4,
} as const satisfies Record<PackedNumberType, number>;

/** A builtin `Variant::Type` or an Object class. An untyped container has none. */
export type ContainerType = { readonly builtin: number } | { readonly className: string };

/** A resource a value names by file, as `Resource("res://…")` spells it. */
export interface ResourceReference {
  readonly path: string;
  readonly uid?: string;
}

export type VariantValue =
  | { readonly type: typeof T.NIL }
  | { readonly type: typeof T.BOOL; readonly value: boolean }
  | { readonly type: typeof T.INT; readonly value: number; readonly exactInteger?: bigint }
  | { readonly type: typeof T.FLOAT; readonly value: number }
  | { readonly type: typeof T.STRING | typeof T.STRING_NAME | typeof T.NODE_PATH; readonly value: string }
  | { readonly type: ComponentType; readonly value: readonly number[] }
  | { readonly type: typeof T.RID; readonly value: number }
  | { readonly type: typeof T.CALLABLE | typeof T.SIGNAL }
  | {
      readonly type: typeof T.OBJECT;
      /** The file of a resource, or absent for an object built in place by `Object(…)`. */
      readonly resource?: ResourceReference;
      readonly className?: string;
      readonly properties?: readonly (readonly [string, VariantValue])[];
    }
  | {
      readonly type: typeof T.ARRAY;
      readonly elements: readonly VariantValue[];
      readonly elementType?: ContainerType;
    }
  | {
      readonly type: typeof T.DICTIONARY;
      readonly entries: readonly (readonly [VariantValue, VariantValue])[];
      readonly keyType?: ContainerType;
      readonly valueType?: ContainerType;
    }
  | { readonly type: PackedNumberType; readonly value: readonly number[] }
  | { readonly type: typeof T.PACKED_STRING_ARRAY; readonly value: readonly string[] };

export const NIL_VALUE: VariantValue = Object.freeze({ type: T.NIL });

export function isComponentType(type: number): type is ComponentType {
  return Object.hasOwn(COMPONENT_COUNTS, type);
}

export function isPackedNumberType(type: number): type is PackedNumberType {
  return Object.hasOwn(PACKED_NUMBER_STRIDES, type);
}

/** The components of `value` where its type is one of {@link COMPONENT_COUNTS}, else undefined. */
export function componentsOf(value: VariantValue): readonly number[] | undefined {
  return isComponentType(value.type) ? (value as { value: readonly number[] }).value : undefined;
}

/** The elements of a packed array as Variants, as indexing it in Godot reads them. */
export function packedElements(value: VariantValue): VariantValue[] {
  if (value.type === T.PACKED_STRING_ARRAY)
    return value.value.map((text) => ({ type: T.STRING, value: text }));
  if (!isPackedNumberType(value.type)) throw new Error(`expected a packed array, got type ${value.type}`);
  const numbers = (value as { value: readonly number[] }).value;
  const stride = PACKED_NUMBER_STRIDES[value.type];
  const type = PACKED_ELEMENT_TYPES[value.type];
  const elements: VariantValue[] = [];
  for (let i = 0; i + stride <= numbers.length; i += stride) {
    const slice = numbers.slice(i, i + stride);
    elements.push((stride === 1 ? { type, value: slice[0] } : { type, value: slice }) as VariantValue);
  }
  return elements;
}
