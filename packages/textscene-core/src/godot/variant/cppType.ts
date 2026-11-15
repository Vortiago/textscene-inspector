/** The Variant type of a C++ type name a Variant registration names (variant_internal.h). */

import type { VariantTypeName } from './value/variant.js';

const VARIANT_OF_CPP: Readonly<Record<string, VariantTypeName>> = {
  void: 'NIL',
  bool: 'BOOL',
  int64_t: 'INT',
  double: 'FLOAT',
  String: 'STRING',
  StringName: 'STRING_NAME',
  NodePath: 'NODE_PATH',
  Vector2: 'VECTOR2',
  Size2: 'VECTOR2',
  Vector2i: 'VECTOR2I',
  Rect2: 'RECT2',
  Rect2i: 'RECT2I',
  Vector3: 'VECTOR3',
  Vector3i: 'VECTOR3I',
  Transform2D: 'TRANSFORM2D',
  Vector4: 'VECTOR4',
  Vector4i: 'VECTOR4I',
  Plane: 'PLANE',
  Quaternion: 'QUATERNION',
  '::AABB': 'AABB',
  Basis: 'BASIS',
  Transform3D: 'TRANSFORM3D',
  Projection: 'PROJECTION',
  Color: 'COLOR',
  '::RID': 'RID',
  Object: 'OBJECT',
  Callable: 'CALLABLE',
  Signal: 'SIGNAL',
  Dictionary: 'DICTIONARY',
  Array: 'ARRAY',
  PackedByteArray: 'PACKED_BYTE_ARRAY',
  PackedInt32Array: 'PACKED_INT32_ARRAY',
  PackedInt64Array: 'PACKED_INT64_ARRAY',
  PackedFloat32Array: 'PACKED_FLOAT32_ARRAY',
  PackedFloat64Array: 'PACKED_FLOAT64_ARRAY',
  PackedStringArray: 'PACKED_STRING_ARRAY',
  PackedVector2Array: 'PACKED_VECTOR2_ARRAY',
  PackedVector3Array: 'PACKED_VECTOR3_ARRAY',
  PackedColorArray: 'PACKED_COLOR_ARRAY',
  PackedVector4Array: 'PACKED_VECTOR4_ARRAY',
};

export function variantTypeOfCpp(cppType: string): VariantTypeName {
  const type = VARIANT_OF_CPP[cppType];
  if (type === undefined) throw new Error(`expected a Variant C++ type, got ${cppType}`);
  return type;
}
