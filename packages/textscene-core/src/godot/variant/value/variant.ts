import type { Aabb } from '../../math/aabb.js';
import type { BasisComponents } from '../../math/basis.js';
import type { Rgba } from '../../math/math.js';
import type { Plane } from '../../math/plane.js';
import type { Quaternion } from '../../math/quaternion.js';
import type { Rect2 } from '../../math/rect2.js';
import type { Transform2DColumns } from '../../math/transform2d.js';
import type { Transform3D } from '../../math/transform3d.js';
import type { Vector2, Vector3 } from '../../math/vector.js';
import type { NodePathParts } from '../../string/nodePathParts.js';
import type { VARIANT_TYPE } from '../variantType.js';

export type VariantTypeName = keyof typeof VARIANT_TYPE;

export type Vector2Value = Readonly<Vector2>;
export type Vector3Value = Readonly<Vector3>;
export type Vector4Value = Readonly<Quaternion>;
export type ColorValue = Readonly<Rgba>;
export type ProjectionValue = readonly [Vector4Value, Vector4Value, Vector4Value, Vector4Value];

/** A Callable: a standard one of object 0, a `VariantCallable`, or a bind or an unbind of another. */
export type CallableValue = StandardCallable | VariantCallableValue | BoundCallable | UnboundCallable;

/** A Callable of object 0, which every Object here is: null when its method is empty. */
export interface StandardCallable {
  readonly kind: 'standard';
  readonly method: string;
}

/** `VariantCallable` (variant_callable.cpp:82): the hash is taken once, when it is made. */
export interface VariantCallableValue {
  readonly kind: 'variant';
  readonly method: string;
  readonly base: Variant;
  readonly hash: number;
}

/** `CallableCustomBind` (callable_bind.cpp): `binds` go after the arguments of a call. */
export interface BoundCallable {
  readonly kind: 'bind';
  readonly callable: CallableValue;
  readonly binds: readonly Variant[];
}

/** `CallableCustomUnbind` (callable_bind.cpp): a call drops its last `count` arguments. */
export interface UnboundCallable {
  readonly kind: 'unbind';
  readonly callable: CallableValue;
  readonly count: number;
}

export interface DictionaryEntry {
  readonly key: Variant;
  readonly value: Variant;
}

// An INT holds int64 as a bigint, and a real_t component the float32 value it stores.
/** An OBJECT is always null. A SIGNAL holds its signal name, empty when null. */
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
  NODE_PATH: NodePathParts;
  RID: bigint;
  OBJECT: null;
  CALLABLE: CallableValue;
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

/** A container's element type: a `Variant::Type` number, past the last type too, and a class for OBJECT. */
export interface ContainerType {
  readonly type: number;
  readonly className: string;
}

// An absent type is NIL, an untyped container. An expression's scripts are always null, so none is held.
interface ContainerTyping {
  ARRAY: { readonly elementType?: ContainerType };
  DICTIONARY: { readonly keyType?: ContainerType; readonly valueType?: ContainerType };
}

export type VariantOf<T extends VariantTypeName> = {
  readonly type: T;
  readonly value: VariantValues[T];
} & (T extends keyof ContainerTyping ? ContainerTyping[T] : unknown);

export type Variant = { [T in VariantTypeName]: VariantOf<T> }[VariantTypeName];

export function variant<T extends VariantTypeName>(type: T, value: VariantValues[T]): VariantOf<T> {
  return { type, value } as VariantOf<T>;
}

export const NIL: VariantOf<'NIL'> = Object.freeze(variant('NIL', null));

export const isNumber = (value: Variant): boolean => value.type === 'INT' || value.type === 'FLOAT';

export const bool = (value: boolean): VariantOf<'BOOL'> => variant('BOOL', value);
export const int = (value: bigint | number): VariantOf<'INT'> => variant('INT', BigInt(value));
export const real = (value: number): VariantOf<'FLOAT'> => variant('FLOAT', value);
export const vector2 = (value: Vector2Value): VariantOf<'VECTOR2'> => variant('VECTOR2', value);
export const vector3 = (value: Vector3Value): VariantOf<'VECTOR3'> => variant('VECTOR3', value);
export const vector3OrNil = (value: Vector3Value | undefined): Variant => (value ? vector3(value) : NIL);

/** `MAX_RECURSION` (typedefs.h:380): how deep a container walk goes before Godot prints an error. */
export const MAX_RECURSION = 100;
