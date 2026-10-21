/**
 * Godot's `Variant::Type` (`variant.h:96-145`), the numbers `node-properties.json` and
 * `resource-properties.json` record in each row's `type`. The names are the engine's,
 * so hover and the editor's value completion speak the vocabulary a `.tscn` reader knows.
 */

/** The `Variant::Type` numbers, in the order `variant.h:96-145` declares them. */
export const VARIANT_TYPE = {
  NIL: 0,
  BOOL: 1,
  INT: 2,
  FLOAT: 3,
  STRING: 4,
  VECTOR2: 5,
  VECTOR2I: 6,
  RECT2: 7,
  RECT2I: 8,
  VECTOR3: 9,
  VECTOR3I: 10,
  TRANSFORM2D: 11,
  VECTOR4: 12,
  VECTOR4I: 13,
  PLANE: 14,
  QUATERNION: 15,
  AABB: 16,
  BASIS: 17,
  TRANSFORM3D: 18,
  PROJECTION: 19,
  COLOR: 20,
  STRING_NAME: 21,
  NODE_PATH: 22,
  RID: 23,
  OBJECT: 24,
  CALLABLE: 25,
  SIGNAL: 26,
  DICTIONARY: 27,
  ARRAY: 28,
  PACKED_BYTE_ARRAY: 29,
  PACKED_INT32_ARRAY: 30,
  PACKED_INT64_ARRAY: 31,
  PACKED_FLOAT32_ARRAY: 32,
  PACKED_FLOAT64_ARRAY: 33,
  PACKED_STRING_ARRAY: 34,
  PACKED_VECTOR2_ARRAY: 35,
  PACKED_VECTOR3_ARRAY: 36,
  PACKED_COLOR_ARRAY: 37,
  PACKED_VECTOR4_ARRAY: 38,
} as const;

type VariantType = (typeof VARIANT_TYPE)[keyof typeof VARIANT_TYPE];

/** The engine name of each `Variant::Type`, keyed by its constant so a type cannot lose its name. */
const VARIANT_TYPE_NAMES: Readonly<Record<VariantType, string>> = {
  [VARIANT_TYPE.NIL]: 'Nil',
  [VARIANT_TYPE.BOOL]: 'bool',
  [VARIANT_TYPE.INT]: 'int',
  [VARIANT_TYPE.FLOAT]: 'float',
  [VARIANT_TYPE.STRING]: 'String',
  [VARIANT_TYPE.VECTOR2]: 'Vector2',
  [VARIANT_TYPE.VECTOR2I]: 'Vector2i',
  [VARIANT_TYPE.RECT2]: 'Rect2',
  [VARIANT_TYPE.RECT2I]: 'Rect2i',
  [VARIANT_TYPE.VECTOR3]: 'Vector3',
  [VARIANT_TYPE.VECTOR3I]: 'Vector3i',
  [VARIANT_TYPE.TRANSFORM2D]: 'Transform2D',
  [VARIANT_TYPE.VECTOR4]: 'Vector4',
  [VARIANT_TYPE.VECTOR4I]: 'Vector4i',
  [VARIANT_TYPE.PLANE]: 'Plane',
  [VARIANT_TYPE.QUATERNION]: 'Quaternion',
  [VARIANT_TYPE.AABB]: 'AABB',
  [VARIANT_TYPE.BASIS]: 'Basis',
  [VARIANT_TYPE.TRANSFORM3D]: 'Transform3D',
  [VARIANT_TYPE.PROJECTION]: 'Projection',
  [VARIANT_TYPE.COLOR]: 'Color',
  [VARIANT_TYPE.STRING_NAME]: 'StringName',
  [VARIANT_TYPE.NODE_PATH]: 'NodePath',
  [VARIANT_TYPE.RID]: 'RID',
  [VARIANT_TYPE.OBJECT]: 'Object',
  [VARIANT_TYPE.CALLABLE]: 'Callable',
  [VARIANT_TYPE.SIGNAL]: 'Signal',
  [VARIANT_TYPE.DICTIONARY]: 'Dictionary',
  [VARIANT_TYPE.ARRAY]: 'Array',
  [VARIANT_TYPE.PACKED_BYTE_ARRAY]: 'PackedByteArray',
  [VARIANT_TYPE.PACKED_INT32_ARRAY]: 'PackedInt32Array',
  [VARIANT_TYPE.PACKED_INT64_ARRAY]: 'PackedInt64Array',
  [VARIANT_TYPE.PACKED_FLOAT32_ARRAY]: 'PackedFloat32Array',
  [VARIANT_TYPE.PACKED_FLOAT64_ARRAY]: 'PackedFloat64Array',
  [VARIANT_TYPE.PACKED_STRING_ARRAY]: 'PackedStringArray',
  [VARIANT_TYPE.PACKED_VECTOR2_ARRAY]: 'PackedVector2Array',
  [VARIANT_TYPE.PACKED_VECTOR3_ARRAY]: 'PackedVector3Array',
  [VARIANT_TYPE.PACKED_COLOR_ARRAY]: 'PackedColorArray',
  [VARIANT_TYPE.PACKED_VECTOR4_ARRAY]: 'PackedVector4Array',
};

/**
 * The engine name of a `Variant::Type` number, or `undefined` for a number the union does
 * not hold. A host shows the number itself there rather than inventing a name.
 */
export function variantTypeName(type: number): string | undefined {
  return VARIANT_TYPE_NAMES[type as VariantType];
}
