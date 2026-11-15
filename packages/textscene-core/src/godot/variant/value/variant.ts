import type { Aabb } from '../../math/aabb.js';
import type { BasisComponents } from '../../math/basis.js';
import type { Rgba } from '../../math/math.js';
import type { Plane } from '../../math/plane.js';
import type { Quaternion } from '../../math/quaternion.js';
import type { Rect2 } from '../../math/rect2.js';
import type { Transform2DColumns } from '../../math/transform2d.js';
import type { Transform3D } from '../../math/transform3d.js';
import type { Vector2, Vector3 } from '../../math/vector.js';
import type { VARIANT_TYPE } from '../variantType.js';

export type VariantTypeName = keyof typeof VARIANT_TYPE;

export type Vector2Value = Readonly<Vector2>;
export type Vector3Value = Readonly<Vector3>;
export type Vector4Value = Readonly<Quaternion>;
export type ColorValue = Readonly<Rgba>;
export type ProjectionValue = readonly [Vector4Value, Vector4Value, Vector4Value, Vector4Value];

export interface DictionaryEntry {
  readonly key: Variant;
  readonly value: Variant;
}

// An INT holds int64 as a bigint, and a real_t component the float32 value it stores.
/** An OBJECT is always null. A CALLABLE or SIGNAL holds its method or signal name, empty when null. */
export interface VariantValues {
  NIL: null;
  BOOL: boolean;
  INT: bigint;
  FLOAT: number;
  STRING: string;
  VECTOR2: Vector2Value;
  VECTOR2I: Vector2Value;
  RECT2: Readonly<Rect2>;
  RECT2I: Readonly<Rect2>;
  VECTOR3: Vector3Value;
  VECTOR3I: Vector3Value;
  TRANSFORM2D: Transform2DColumns;
  VECTOR4: Vector4Value;
  VECTOR4I: Vector4Value;
  PLANE: Plane;
  QUATERNION: Vector4Value;
  AABB: Readonly<Aabb>;
  BASIS: BasisComponents;
  TRANSFORM3D: Readonly<Transform3D>;
  PROJECTION: ProjectionValue;
  COLOR: ColorValue;
  STRING_NAME: string;
  NODE_PATH: string;
  RID: bigint;
  OBJECT: null;
  CALLABLE: string;
  SIGNAL: string;
  DICTIONARY: readonly DictionaryEntry[];
  ARRAY: readonly Variant[];
  PACKED_BYTE_ARRAY: readonly number[];
  PACKED_INT32_ARRAY: readonly number[];
  PACKED_INT64_ARRAY: readonly bigint[];
  PACKED_FLOAT32_ARRAY: readonly number[];
  PACKED_FLOAT64_ARRAY: readonly number[];
  PACKED_STRING_ARRAY: readonly string[];
  PACKED_VECTOR2_ARRAY: readonly Vector2Value[];
  PACKED_VECTOR3_ARRAY: readonly Vector3Value[];
  PACKED_COLOR_ARRAY: readonly ColorValue[];
  PACKED_VECTOR4_ARRAY: readonly Vector4Value[];
}

export type VariantOf<T extends VariantTypeName> = { readonly type: T; readonly value: VariantValues[T] };

export type Variant = { [T in VariantTypeName]: VariantOf<T> }[VariantTypeName];

export function variant<T extends VariantTypeName>(type: T, value: VariantValues[T]): VariantOf<T> {
  return { type, value };
}

export const NIL: VariantOf<'NIL'> = Object.freeze(variant('NIL', null));
