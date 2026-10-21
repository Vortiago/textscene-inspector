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

/** The engine name of each `Variant::Type`, indexed by its number, `Nil` (0) to `PackedVector4Array` (38). */
const VARIANT_TYPE_NAMES: readonly string[] = [
  'Nil',
  'bool',
  'int',
  'float',
  'String',
  'Vector2',
  'Vector2i',
  'Rect2',
  'Rect2i',
  'Vector3',
  'Vector3i',
  'Transform2D',
  'Vector4',
  'Vector4i',
  'Plane',
  'Quaternion',
  'AABB',
  'Basis',
  'Transform3D',
  'Projection',
  'Color',
  'StringName',
  'NodePath',
  'RID',
  'Object',
  'Callable',
  'Signal',
  'Dictionary',
  'Array',
  'PackedByteArray',
  'PackedInt32Array',
  'PackedInt64Array',
  'PackedFloat32Array',
  'PackedFloat64Array',
  'PackedStringArray',
  'PackedVector2Array',
  'PackedVector3Array',
  'PackedColorArray',
  'PackedVector4Array',
];

/**
 * The engine name of a `Variant::Type` number, or `undefined` for a number the union does
 * not hold. A host shows the number itself there rather than inventing a name.
 */
export function variantTypeName(type: number): string | undefined {
  return VARIANT_TYPE_NAMES[type];
}
