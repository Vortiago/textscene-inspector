/**
 * A Godot `Variant` value (variant.h:96), tagged with its `Variant::Type` name. An INT holds
 * int64 as a bigint, a FLOAT a double, and every real_t component the float32 value it stores.
 */

import type { VARIANT_TYPE } from '../variantType.js';

export type VariantTypeName = keyof typeof VARIANT_TYPE;

export interface Vector2Value {
  readonly x: number;
  readonly y: number;
}
export interface Vector3Value {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
export interface Vector4Value {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}
export interface RectValue {
  readonly position: Vector2Value;
  readonly size: Vector2Value;
}
export interface Transform2DValue {
  readonly x: Vector2Value;
  readonly y: Vector2Value;
  readonly origin: Vector2Value;
}
export interface PlaneValue {
  readonly normal: Vector3Value;
  readonly d: number;
}
export interface AabbValue {
  readonly position: Vector3Value;
  readonly size: Vector3Value;
}
export interface BasisValue {
  readonly rows: readonly [Vector3Value, Vector3Value, Vector3Value];
}
export interface Transform3DValue {
  readonly basis: BasisValue;
  readonly origin: Vector3Value;
}
export interface ProjectionValue {
  readonly columns: readonly [Vector4Value, Vector4Value, Vector4Value, Vector4Value];
}
export interface ColorValue {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}
export interface DictionaryEntry {
  readonly key: Variant;
  readonly value: Variant;
}

/** The value each type holds. A null OBJECT, CALLABLE or SIGNAL is the only one an expression makes. */
export interface VariantValues {
  NIL: null;
  BOOL: boolean;
  INT: bigint;
  FLOAT: number;
  STRING: string;
  VECTOR2: Vector2Value;
  VECTOR2I: Vector2Value;
  RECT2: RectValue;
  RECT2I: RectValue;
  VECTOR3: Vector3Value;
  VECTOR3I: Vector3Value;
  TRANSFORM2D: Transform2DValue;
  VECTOR4: Vector4Value;
  VECTOR4I: Vector4Value;
  PLANE: PlaneValue;
  QUATERNION: Vector4Value;
  AABB: AabbValue;
  BASIS: BasisValue;
  TRANSFORM3D: Transform3DValue;
  PROJECTION: ProjectionValue;
  COLOR: ColorValue;
  STRING_NAME: string;
  NODE_PATH: string;
  RID: bigint;
  OBJECT: null;
  CALLABLE: null;
  SIGNAL: null;
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

export function isType<T extends VariantTypeName>(
  value: Variant,
  type: T
): value is Extract<Variant, { type: T }> {
  return value.type === type;
}
