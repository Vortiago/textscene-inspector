/**
 * One Variant of a binary resource, read as `ResourceLoaderBinary::parse_variant` reads it
 * (`core/io/resource_format_binary.cpp:173-678`) and written as Godot's text format spells it
 * (`VariantWriter::write`, `core/variant/variant_parser.cpp`).
 */

import { stringLiteral } from '../../../godot/string/string';
import { componentLiteral, floatLiteral } from '../../../godot/variant/variantWriter';
import { VARIANT_TYPE } from '../../../godot/variant/variantType';
import type { ByteReader } from './byteReader';
import {
  ABSOLUTE_NODE_PATH,
  FORMAT_VERSION_NO_NODEPATH_PROPERTY,
  INLINE_STRING,
  ObjectRef,
  SHARED_LENGTH_MASK,
  VariantTag as Tag,
} from '../../../godot/project/binaryResourceFormat';

/** What a variant names outside itself: the file's tables and format version. */
export interface VariantTables {
  formatVersion: number;
  strings: readonly string[];
  /** The text id of the external resource at each index. */
  externalIds: readonly string[];
  /** The text id of the internal resource at each index. */
  internalIds: readonly string[];
  /** False for a file that names an internal resource by its number, not its table index. */
  hasNamedIds: boolean;
}

/** `_get_string` (`:159-171`): a string-table entry, or an inline string. */
export function tableString(reader: ByteReader, tables: VariantTables): string {
  const index = reader.u32();
  if (index & INLINE_STRING) return reader.utf8(index & ~INLINE_STRING);
  const entry = tables.strings[index];
  if (entry === undefined)
    throw new Error(`expected a string-table index below ${tables.strings.length}, got ${index}`);
  return entry;
}

/** The next variant as Godot's text format spells it. */
export function variantText(reader: ByteReader, tables: VariantTables): string {
  return taggedVariantText(reader.u32() as Tag, reader, tables);
}

/**
 * The next property value as Godot's text format spells it, or null for a null Object. Godot's
 * text saver leaves out an Object property that is null unless its usage stores it when null
 * (`resource_format_text.cpp:1980-1982`), and the binary saver keeps it, so the caller decides.
 */
export function propertyValueText(reader: ByteReader, tables: VariantTables): string | null {
  const tag = reader.u32() as Tag;
  return tag === Tag.Object ? objectText(reader, tables) : taggedVariantText(tag, reader, tables);
}

function taggedVariantText(tag: Tag, reader: ByteReader, tables: VariantTables): string {
  switch (tag) {
    case Tag.Nil:
      return 'null';
    case Tag.Bool:
      return reader.u32() !== 0 ? 'true' : 'false';
    case Tag.Int:
      return String(reader.i32());
    case Tag.Int64:
      return String(reader.i64());
    case Tag.Float:
      return floatLiteral(reader.real());
    case Tag.Double:
      return floatLiteral(reader.f64());
    case Tag.String:
      return stringLiteral(reader.unicodeString());
    case Tag.StringName:
      return stringNameLiteral(reader.unicodeString());
    case Tag.Vector2:
      return call('Vector2', reals(reader, 2));
    case Tag.Vector2i:
      return call('Vector2i', ints(reader, 2));
    case Tag.Rect2:
      return call('Rect2', reals(reader, 4));
    case Tag.Rect2i:
      return call('Rect2i', ints(reader, 4));
    case Tag.Vector3:
      return call('Vector3', reals(reader, 3));
    case Tag.Vector3i:
      return call('Vector3i', ints(reader, 3));
    case Tag.Vector4:
      return call('Vector4', reals(reader, 4));
    case Tag.Vector4i:
      return call('Vector4i', ints(reader, 4));
    case Tag.Plane:
      return call('Plane', reals(reader, 4));
    case Tag.Quaternion:
      return call('Quaternion', reals(reader, 4));
    case Tag.Aabb:
      return call('AABB', reals(reader, 6));
    case Tag.Transform2D:
      return call('Transform2D', reals(reader, 6));
    // The binary file and the text writer both run row by row, then the origin.
    case Tag.Basis:
      return call('Basis', reals(reader, 9));
    case Tag.Transform3D:
      return call('Transform3D', reals(reader, 12));
    case Tag.Projection:
      return call('Projection', reals(reader, 16));
    // A Color is single precision whatever `real_t` is (`:418`).
    case Tag.Color:
      return call('Color', floats(reader, 4));
    case Tag.NodePath:
      return nodePathText(reader, tables);
    // The loader reads a RID as its int id (`:388-390`).
    case Tag.Rid:
      return String(reader.u32());
    case Tag.Object:
      return objectText(reader, tables) ?? 'null';
    case Tag.Callable:
      return 'Callable()';
    case Tag.Signal:
      return 'Signal()';
    case Tag.Dictionary:
      return dictionaryText(reader, tables);
    case Tag.Array:
      return `[${repeat(reader.u32() & SHARED_LENGTH_MASK, () => variantText(reader, tables)).join(', ')}]`;
    case Tag.PackedByteArray:
      return packedByteArrayText(reader);
    case Tag.PackedInt32Array:
      return call('PackedInt32Array', ints(reader, reader.u32()));
    case Tag.PackedInt64Array:
      return call(
        'PackedInt64Array',
        repeat(reader.u32(), () => String(reader.i64()))
      );
    case Tag.PackedFloat32Array:
      return call('PackedFloat32Array', floats(reader, reader.u32()));
    case Tag.PackedFloat64Array:
      return call(
        'PackedFloat64Array',
        repeat(reader.u32(), () => componentLiteral(reader.f64()))
      );
    case Tag.PackedStringArray:
      return call(
        'PackedStringArray',
        repeat(reader.u32(), () => stringLiteral(reader.unicodeString()))
      );
    case Tag.PackedVector2Array:
      return call('PackedVector2Array', reals(reader, reader.u32() * 2));
    case Tag.PackedVector3Array:
      return call('PackedVector3Array', reals(reader, reader.u32() * 3));
    case Tag.PackedVector4Array:
      return call('PackedVector4Array', reals(reader, reader.u32() * 4));
    case Tag.PackedColorArray:
      return call('PackedColorArray', floats(reader, reader.u32() * 4));
    default:
      throw new Error(`expected a binary variant tag, got ${tag as number}`);
  }
}

function call(typeName: string, components: readonly string[]): string {
  return `${typeName}(${components.join(', ')})`;
}

function repeat<T>(count: number, read: () => T): T[] {
  return Array.from({ length: count }, read);
}

function reals(reader: ByteReader, count: number): string[] {
  return repeat(count, () => componentLiteral(reader.real()));
}

function floats(reader: ByteReader, count: number): string[] {
  return repeat(count, () => componentLiteral(reader.f32()));
}

function ints(reader: ByteReader, count: number): string[] {
  return repeat(count, () => String(reader.i32()));
}

/**
 * `:425-449`: names, then subnames, each a table string. A file older than version 3 counts the
 * property field among the subnames.
 */
function nodePathText(reader: ByteReader, tables: VariantTables): string {
  const nameCount = reader.u16();
  const subnameField = reader.u16();
  const isAbsolute = (subnameField & ABSOLUTE_NODE_PATH) !== 0;
  let subnameCount = subnameField & ~ABSOLUTE_NODE_PATH;
  if (tables.formatVersion < FORMAT_VERSION_NO_NODEPATH_PROPERTY) subnameCount += 1;
  const names = repeat(nameCount, () => tableString(reader, tables));
  const subnames = repeat(subnameCount, () => tableString(reader, tables)).filter((name) => name !== '');
  const path = `${isAbsolute ? '/' : ''}${names.join('/')}${subnames.map((name) => `:${name}`).join('')}`;
  return `NodePath(${stringLiteral(path)})`;
}

/** `:453-548`: a resource the property names by index, or by type and path in an old file. Null for none. */
function objectText(reader: ByteReader, tables: VariantTables): string | null {
  const kind = reader.u32() as ObjectRef;
  switch (kind) {
    case ObjectRef.Empty:
      return null;
    case ObjectRef.InternalResource:
      return `SubResource(${stringLiteral(internalId(reader.u32(), tables))})`;
    case ObjectRef.ExternalResourceIndex:
      return `ExtResource(${stringLiteral(tableId(tables.externalIds, reader.u32(), 'external'))})`;
    case ObjectRef.ExternalResource:
      reader.unicodeString();
      return `Resource(${stringLiteral(reader.unicodeString())})`;
    default:
      throw new Error(`expected an object reference kind from 0 to 3, got ${kind as number}`);
  }
}

/** `:399-408`: a table index in a named-ids file, and the resource's own number in one without. */
function internalId(index: number, tables: VariantTables): string {
  return tables.hasNamedIds ? tableId(tables.internalIds, index, 'internal') : String(index);
}

function tableId(ids: readonly string[], index: number, table: string): string {
  const id = ids[index];
  if (id === undefined)
    throw new Error(`expected an ${table} resource index below ${ids.length}, got ${index}`);
  return id;
}

function stringNameLiteral(value: string): string {
  return `&${stringLiteral(value)}`;
}

/** One dictionary entry, with its key as `Variant::operator<` compares it. */
interface DictionaryEntry {
  text: string;
  order: KeyOrder;
}

/**
 * A key as Godot orders it: its `Variant::Type`, then its value. A type with no `OP_LESS`
 * (`variant_op.cpp:731-745`) holds no value, and Godot leaves it where the file puts it.
 */
type KeyOrder = { type: number } & KeyValue;

type KeyValue =
  | { kind: 'numbers'; value: readonly (number | bigint)[] }
  | { kind: 'text'; value: string }
  | { kind: 'array'; value: readonly KeyOrder[] }
  | { kind: 'none' };

/**
 * `:582-597`. Godot's writer puts each entry on its own line, its keys sorted by
 * `StringLikeVariantOrder` (`variant_parser.cpp:2306-2307`, `variant.cpp:3409-3427`).
 */
function dictionaryText(reader: ByteReader, tables: VariantTables): string {
  const entries = repeat(reader.u32() & SHARED_LENGTH_MASK, () => dictionaryEntry(reader, tables));
  if (entries.length === 0) return '{}';
  entries.sort((a, b) => (isKeyLess(a.order, b.order) ? -1 : isKeyLess(b.order, a.order) ? 1 : 0));
  const lines = entries.map(({ text }) => text);
  return `{\n${lines.join(',\n')}\n}`;
}

/** The key is read twice: once for its text, and once from the same bytes for its order. */
function dictionaryEntry(reader: ByteReader, tables: VariantTables): DictionaryEntry {
  const keyStart = reader.position;
  const key = variantText(reader, tables);
  reader.seek(keyStart);
  const order = keyOrder(reader, tables);
  return { text: `${key}: ${variantText(reader, tables)}`, order };
}

/** The `Variant::Type` of each tag. A RID loads as its int id (`:388-390`). */
const VARIANT_TYPE_OF_TAG: Readonly<Record<Tag, number>> = {
  [Tag.Nil]: VARIANT_TYPE.NIL,
  [Tag.Bool]: VARIANT_TYPE.BOOL,
  [Tag.Int]: VARIANT_TYPE.INT,
  [Tag.Int64]: VARIANT_TYPE.INT,
  [Tag.Float]: VARIANT_TYPE.FLOAT,
  [Tag.Double]: VARIANT_TYPE.FLOAT,
  [Tag.String]: VARIANT_TYPE.STRING,
  [Tag.Vector2]: VARIANT_TYPE.VECTOR2,
  [Tag.Vector2i]: VARIANT_TYPE.VECTOR2I,
  [Tag.Rect2]: VARIANT_TYPE.RECT2,
  [Tag.Rect2i]: VARIANT_TYPE.RECT2I,
  [Tag.Vector3]: VARIANT_TYPE.VECTOR3,
  [Tag.Vector3i]: VARIANT_TYPE.VECTOR3I,
  [Tag.Transform2D]: VARIANT_TYPE.TRANSFORM2D,
  [Tag.Vector4]: VARIANT_TYPE.VECTOR4,
  [Tag.Vector4i]: VARIANT_TYPE.VECTOR4I,
  [Tag.Plane]: VARIANT_TYPE.PLANE,
  [Tag.Quaternion]: VARIANT_TYPE.QUATERNION,
  [Tag.Aabb]: VARIANT_TYPE.AABB,
  [Tag.Basis]: VARIANT_TYPE.BASIS,
  [Tag.Transform3D]: VARIANT_TYPE.TRANSFORM3D,
  [Tag.Projection]: VARIANT_TYPE.PROJECTION,
  [Tag.Color]: VARIANT_TYPE.COLOR,
  [Tag.StringName]: VARIANT_TYPE.STRING_NAME,
  [Tag.NodePath]: VARIANT_TYPE.NODE_PATH,
  [Tag.Rid]: VARIANT_TYPE.INT,
  [Tag.Object]: VARIANT_TYPE.OBJECT,
  [Tag.InputEvent]: VARIANT_TYPE.OBJECT,
  [Tag.Callable]: VARIANT_TYPE.CALLABLE,
  [Tag.Signal]: VARIANT_TYPE.SIGNAL,
  [Tag.Dictionary]: VARIANT_TYPE.DICTIONARY,
  [Tag.Array]: VARIANT_TYPE.ARRAY,
  [Tag.PackedByteArray]: VARIANT_TYPE.PACKED_BYTE_ARRAY,
  [Tag.PackedInt32Array]: VARIANT_TYPE.PACKED_INT32_ARRAY,
  [Tag.PackedInt64Array]: VARIANT_TYPE.PACKED_INT64_ARRAY,
  [Tag.PackedFloat32Array]: VARIANT_TYPE.PACKED_FLOAT32_ARRAY,
  [Tag.PackedFloat64Array]: VARIANT_TYPE.PACKED_FLOAT64_ARRAY,
  [Tag.PackedStringArray]: VARIANT_TYPE.PACKED_STRING_ARRAY,
  [Tag.PackedVector2Array]: VARIANT_TYPE.PACKED_VECTOR2_ARRAY,
  [Tag.PackedVector3Array]: VARIANT_TYPE.PACKED_VECTOR3_ARRAY,
  [Tag.PackedColorArray]: VARIANT_TYPE.PACKED_COLOR_ARRAY,
  [Tag.PackedVector4Array]: VARIANT_TYPE.PACKED_VECTOR4_ARRAY,
};

/** The next variant as a key order. A type Godot cannot order is read past through its text. */
function keyOrder(reader: ByteReader, tables: VariantTables): KeyOrder {
  const tag = reader.u32() as Tag;
  const type = VARIANT_TYPE_OF_TAG[tag];
  if (type === undefined) throw new Error(`expected a binary variant tag, got ${tag as number}`);
  return { type, ...keyValue(tag, reader, tables) };
}

function keyValue(tag: Tag, reader: ByteReader, tables: VariantTables): KeyValue {
  const numbers = (value: readonly (number | bigint)[]): KeyValue => ({ kind: 'numbers', value });
  switch (tag) {
    case Tag.Bool:
      return numbers([reader.u32() !== 0 ? 1 : 0]);
    case Tag.Int:
      return numbers([reader.i32()]);
    case Tag.Int64:
      return numbers([reader.i64()]);
    case Tag.Float:
      return numbers([reader.real()]);
    case Tag.Double:
      return numbers([reader.f64()]);
    case Tag.Rid:
      return numbers([reader.u32()]);
    case Tag.String:
    case Tag.StringName:
      return { kind: 'text', value: reader.unicodeString() };
    case Tag.Vector2:
      return numbers(repeat(2, () => reader.real()));
    case Tag.Vector2i:
      return numbers(repeat(2, () => reader.i32()));
    case Tag.Vector3:
      return numbers(repeat(3, () => reader.real()));
    case Tag.Vector3i:
      return numbers(repeat(3, () => reader.i32()));
    case Tag.Vector4:
      return numbers(repeat(4, () => reader.real()));
    case Tag.Vector4i:
      return numbers(repeat(4, () => reader.i32()));
    case Tag.Array:
      return {
        kind: 'array',
        value: repeat(reader.u32() & SHARED_LENGTH_MASK, () => keyOrder(reader, tables)),
      };
    default:
      taggedVariantText(tag, reader, tables);
      return { kind: 'none' };
  }
}

/** `StringLikeVariantOrder::compare`: two string-like keys by their text, any other pair by `operator<`. */
function isKeyLess(a: KeyOrder, b: KeyOrder): boolean {
  if (a.kind === 'text' && b.kind === 'text') return codePointOrder(a.value, b.value) < 0;
  return isVariantLess(a, b);
}

/** `Variant::operator<` (`variant.cpp:882-890`): by type, then by the type's `OP_LESS`, false without one. */
function isVariantLess(a: KeyOrder, b: KeyOrder): boolean {
  if (a.type !== b.type) return a.type < b.type;
  if (a.kind === 'text' && b.kind === 'text') return codePointOrder(a.value, b.value) < 0;
  if (a.kind === 'array' && b.kind === 'array') return isArrayLess(a.value, b.value);
  if (a.kind === 'numbers' && b.kind === 'numbers') return isComponentLess(a.value, b.value);
  return false;
}

/** A scalar, or a vector compared component by component (`vector2.h:164`). */
function isComponentLess(a: readonly (number | bigint)[], b: readonly (number | bigint)[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i]! < b[i]!;
  }
  return false;
}

/** `Array::operator<` (`array.cpp:164-179`): element by element, then the shorter first. */
function isArrayLess(a: readonly KeyOrder[], b: readonly KeyOrder[]): boolean {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (isVariantLess(a[i]!, b[i]!)) return true;
    if (isVariantLess(b[i]!, a[i]!)) return false;
  }
  return a.length < b.length;
}

/**
 * `str_compare`, as `StringName::AlphCompare` runs it: code point by code point, which UTF-16 order
 * breaks above U+FFFF. Equal prefixes span equal code units, so one index walks both strings.
 */
function codePointOrder(a: string, b: string): number {
  for (let i = 0; i < a.length && i < b.length;) {
    const left = a.codePointAt(i)!;
    const delta = left - b.codePointAt(i)!;
    if (delta !== 0) return delta;
    i += left > 0xffff ? 2 : 1;
  }
  return a.length - b.length;
}

/** `:612-623`: the bytes, then padding to a multiple of four. Godot's writer spells them as base64. */
function packedByteArrayText(reader: ByteReader): string {
  const length = reader.u32();
  const bytes = reader.take(length);
  reader.take((4 - (length % 4)) % 4);
  if (length === 0) return 'PackedByteArray()';
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `PackedByteArray(${stringLiteral(btoa(binary))})`;
}
