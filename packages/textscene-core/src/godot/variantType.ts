/**
 * Godot's `Variant::Type` (`variant.h:96-145`), the numbers `node-properties.json` and
 * `resource-properties.json` record in each row's `type`. The names are the engine's,
 * so hover and the editor's value completion speak the vocabulary a `.tscn` reader knows.
 */

/** The `Variant::Type` numbers the language features compare against. */
export const VARIANT_TYPE = {
  BOOL: 1,
  INT: 2,
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
