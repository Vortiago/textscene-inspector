/**
 * The layout facts of Godot's binary resource format (`RSRC`), from
 * `core/io/resource_format_binary.cpp` and `resource_format_binary.h` in Godot 4.6.3.
 */

export const BINARY_RESOURCE_MAGIC = 'RSRC';

/** A file saved with `ResourceSaver::FLAG_COMPRESS` starts with this instead (`.cpp:988`). */
export const COMPRESSED_BINARY_RESOURCE_MAGIC = 'RSCC';

/** The format version Godot 4.6 writes (`.cpp:98`). */
export const BINARY_FORMAT_VERSION = 6;

/** The engine major version a file may record and still load, Godot's own (`.cpp:1026`). */
export const ENGINE_MAJOR_VERSION = 4;

/** Version 3 dropped the property field a NodePath carried (`.cpp:94,100`). */
export const FORMAT_VERSION_NO_NODEPATH_PROPERTY = 3;

/** `ResourceFormatSaverBinaryInstance`'s header flags (`.h:169-172`). */
export enum BinaryFormatFlag {
  NamedSceneIds = 1,
  Uids = 2,
  RealTIsDouble = 4,
  HasScriptClass = 8,
}

/** `RESERVED_FIELDS` (`.h:175`): u32 fields the header skips. */
export const RESERVED_FIELDS = 11;

/** An internal resource's path in a named-ids file: `local://` and its id (`.cpp:719-724`). */
export const LOCAL_RESOURCE_PREFIX = 'local://';

/** What joins a file's path and an internal resource's id in the resource's own path (`.cpp:722`). */
export const SUB_RESOURCE_SEPARATOR = '::';

/** The variant tags (`.cpp:45-88`). */
export enum VariantTag {
  Nil = 1,
  Bool = 2,
  Int = 3,
  Float = 4,
  String = 5,
  Vector2 = 10,
  Rect2 = 11,
  Vector3 = 12,
  Plane = 13,
  Quaternion = 14,
  Aabb = 15,
  Basis = 16,
  Transform3D = 17,
  Transform2D = 18,
  Color = 20,
  NodePath = 22,
  Rid = 23,
  Object = 24,
  InputEvent = 25,
  Dictionary = 26,
  Array = 30,
  PackedByteArray = 31,
  PackedInt32Array = 32,
  PackedFloat32Array = 33,
  PackedStringArray = 34,
  PackedVector3Array = 35,
  PackedColorArray = 36,
  PackedVector2Array = 37,
  Int64 = 40,
  Double = 41,
  Callable = 42,
  Signal = 43,
  StringName = 44,
  Vector2i = 45,
  Rect2i = 46,
  Vector3i = 47,
  PackedInt64Array = 48,
  PackedFloat64Array = 49,
  Vector4 = 50,
  Vector4i = 51,
  Projection = 52,
  PackedVector4Array = 53,
}

/** How an object property names its resource (`.cpp:89-92`). */
export enum ObjectRef {
  Empty = 0,
  ExternalResource = 1,
  InternalResource = 2,
  ExternalResourceIndex = 3,
}

/** The top bit of an array or dictionary length marks it shared (`.cpp:589`, `:604`), not counted. */
export const SHARED_LENGTH_MASK = 0x7fffffff;

/** The top bit of a string-table index marks an inline string of that length (`.cpp:159-171`). */
export const INLINE_STRING = 0x80000000;

/** The NodePath subname count's top bit marks it absolute (`.cpp:432-434`). */
export const ABSOLUTE_NODE_PATH = 0x8000;
