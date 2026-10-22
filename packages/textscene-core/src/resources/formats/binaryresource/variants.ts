/**
 * One Variant of a binary resource, read as `ResourceLoaderBinary::parse_variant` reads it
 * (`core/io/resource_format_binary.cpp:173-678`) and written as Godot's text format spells it
 * (`VariantWriter::write`, `core/variant/variant_parser.cpp`).
 */

import { stringLiteral } from '../../../godot/string/string';
import { componentLiteral, floatLiteral } from '../../../godot/variant/variantWriter';
import { VARIANT_TYPE } from '../../../godot/variant/variantType';
import { sortArray } from '../../../godot/templates/sortArray';
import type { ByteReader } from './byteReader';
import {
  ABSOLUTE_NODE_PATH,
  FORMAT_VERSION_NO_NODEPATH_PROPERTY,
  INLINE_STRING,
  ObjectRef,
  SHARED_LENGTH_MASK,
  VariantTag,
} from '../../../godot/project/binaryResourceFormat';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

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
function variantText(reader: ByteReader, tables: VariantTables): string {
  return taggedVariant(reader.u32() as EnumValue<typeof VariantTag>, reader, tables).text;
}

/** The next variant, read once for its text and for its order as a dictionary key. */
function readVariant(reader: ByteReader, tables: VariantTables): ReadVariant {
  const tag = reader.u32() as EnumValue<typeof VariantTag>;
  const tagType = VARIANT_TYPE_OF_TAG[tag];
  if (tagType === undefined) throw new Error(`expected a binary variant tag, got ${tag as number}`);
  const { text, value } = taggedVariant(tag, reader, tables);
  // A null Object loads as Nil (`:395-397`), so it orders as Nil. Only Nil and it write `null`.
  const type = text === 'null' ? VARIANT_TYPE.NIL : tagType;
  return { text, order: { type, ...value } };
}

/**
 * The next property value as Godot's text format spells it, or null for a null Object. Godot's
 * text saver leaves out an Object property that is null unless its usage stores it when null
 * (`resource_format_text.cpp:1980-1982`), and the binary saver keeps it, so the caller decides.
 */
export function propertyValueText(reader: ByteReader, tables: VariantTables): string | null {
  const tag = reader.u32() as EnumValue<typeof VariantTag>;
  return tag === VariantTag.Object ? objectText(reader, tables) : taggedVariant(tag, reader, tables).text;
}

/** The variants `OP_LESS` orders (`variant_op.cpp:731-745`) carry their value. The rest carry none. */
function taggedVariant(
  tag: EnumValue<typeof VariantTag>,
  reader: ByteReader,
  tables: VariantTables
): { text: string; value: KeyValue } {
  switch (tag) {
    case VariantTag.Bool: {
      const isTrue = reader.u32() !== 0;
      return numbered(isTrue ? 'true' : 'false', [isTrue ? 1 : 0]);
    }
    case VariantTag.Int:
      return integer(reader.i32());
    case VariantTag.Int64:
      return integer(reader.i64());
    // The loader reads a RID as its int id (`:388-390`).
    case VariantTag.Rid:
      return integer(reader.u32());
    case VariantTag.Float:
      return real(reader.real());
    case VariantTag.Double:
      return real(reader.f64());
    case VariantTag.String: {
      const value = reader.unicodeString();
      return { text: stringLiteral(value), value: { kind: 'text', value } };
    }
    case VariantTag.StringName: {
      const value = reader.unicodeString();
      return { text: stringNameLiteral(value), value: { kind: 'text', value } };
    }
    case VariantTag.Vector2:
      return realVector('Vector2', realValues(reader, 2));
    case VariantTag.Vector2i:
      return intVector('Vector2i', intValues(reader, 2));
    case VariantTag.Vector3:
      return realVector('Vector3', realValues(reader, 3));
    case VariantTag.Vector3i:
      return intVector('Vector3i', intValues(reader, 3));
    case VariantTag.Vector4:
      return realVector('Vector4', realValues(reader, 4));
    case VariantTag.Vector4i:
      return intVector('Vector4i', intValues(reader, 4));
    case VariantTag.Array: {
      const elements = repeat(reader.u32() & SHARED_LENGTH_MASK, () => readVariant(reader, tables));
      return {
        text: `[${elements.map(({ text }) => text).join(', ')}]`,
        value: { kind: 'array', value: elements.map(({ order }) => order) },
      };
    }
    default:
      return { text: unorderedVariantText(tag, reader, tables), value: UNORDERED };
  }
}

const UNORDERED: KeyValue = { kind: 'none' };

function numbered(text: string, value: readonly (number | bigint)[]): { text: string; value: KeyValue } {
  return { text, value: { kind: 'numbers', value } };
}

function integer(value: number | bigint): { text: string; value: KeyValue } {
  return numbered(String(value), [value]);
}

function real(value: number): { text: string; value: KeyValue } {
  return numbered(floatLiteral(value), [value]);
}

function realVector(typeName: string, values: number[]): { text: string; value: KeyValue } {
  return numbered(call(typeName, values.map(componentLiteral)), values);
}

function intVector(typeName: string, values: number[]): { text: string; value: KeyValue } {
  return numbered(call(typeName, values.map(String)), values);
}

function unorderedVariantText(
  tag: EnumValue<typeof VariantTag>,
  reader: ByteReader,
  tables: VariantTables
): string {
  switch (tag) {
    case VariantTag.Nil:
      return 'null';
    case VariantTag.Rect2:
      return call('Rect2', reals(reader, 4));
    case VariantTag.Rect2i:
      return call('Rect2i', ints(reader, 4));
    case VariantTag.Plane:
      return call('Plane', reals(reader, 4));
    case VariantTag.Quaternion:
      return call('Quaternion', reals(reader, 4));
    case VariantTag.Aabb:
      return call('AABB', reals(reader, 6));
    case VariantTag.Transform2D:
      return call('Transform2D', reals(reader, 6));
    // The binary file and the text writer both run row by row, then the origin.
    case VariantTag.Basis:
      return call('Basis', reals(reader, 9));
    case VariantTag.Transform3D:
      return call('Transform3D', reals(reader, 12));
    case VariantTag.Projection:
      return call('Projection', reals(reader, 16));
    // A Color is single precision whatever `real_t` is (`:418`).
    case VariantTag.Color:
      return call('Color', floats(reader, 4));
    case VariantTag.NodePath:
      return nodePathText(reader, tables);
    case VariantTag.Object:
      return objectText(reader, tables) ?? 'null';
    case VariantTag.Callable:
      return 'Callable()';
    case VariantTag.Signal:
      return 'Signal()';
    case VariantTag.Dictionary:
      return dictionaryText(reader, tables);
    case VariantTag.PackedByteArray:
      return packedByteArrayText(reader);
    case VariantTag.PackedInt32Array:
      return call('PackedInt32Array', ints(reader, reader.u32()));
    case VariantTag.PackedInt64Array:
      return call(
        'PackedInt64Array',
        repeat(reader.u32(), () => String(reader.i64()))
      );
    case VariantTag.PackedFloat32Array:
      return call('PackedFloat32Array', floats(reader, reader.u32()));
    case VariantTag.PackedFloat64Array:
      return call(
        'PackedFloat64Array',
        repeat(reader.u32(), () => componentLiteral(reader.f64()))
      );
    case VariantTag.PackedStringArray:
      return call(
        'PackedStringArray',
        repeat(reader.u32(), () => stringLiteral(reader.unicodeString()))
      );
    case VariantTag.PackedVector2Array:
      return call('PackedVector2Array', reals(reader, reader.u32() * 2));
    case VariantTag.PackedVector3Array:
      return call('PackedVector3Array', reals(reader, reader.u32() * 3));
    case VariantTag.PackedVector4Array:
      return call('PackedVector4Array', reals(reader, reader.u32() * 4));
    case VariantTag.PackedColorArray:
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

function realValues(reader: ByteReader, count: number): number[] {
  return repeat(count, () => reader.real());
}

function reals(reader: ByteReader, count: number): string[] {
  return realValues(reader, count).map(componentLiteral);
}

function floats(reader: ByteReader, count: number): string[] {
  return repeat(count, () => componentLiteral(reader.f32()));
}

function intValues(reader: ByteReader, count: number): number[] {
  return repeat(count, () => reader.i32());
}

function ints(reader: ByteReader, count: number): string[] {
  return intValues(reader, count).map(String);
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
  const kind = reader.u32() as EnumValue<typeof ObjectRef>;
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

/** A variant's text, and its value as `Variant::operator<` compares it. */
interface ReadVariant {
  text: string;
  order: KeyOrder;
}

/**
 * A key as Godot orders it: its `Variant::Type`, then its value. A type with no `OP_LESS`
 * holds no value, and ties with every key of its type.
 */
type KeyOrder = { type: number } & KeyValue;

type KeyValue =
  | { kind: 'numbers'; value: readonly (number | bigint)[] }
  | { kind: 'text'; value: string }
  | { kind: 'array'; value: readonly KeyOrder[] }
  | { kind: 'none' };

/**
 * `:582-597`. Godot's writer puts each entry on its own line, its keys sorted by
 * `StringLikeVariantOrder` (`variant_parser.cpp:2306-2307`, `variant.cpp:3409-3427`) with
 * `SortArray`, which leaves keys it cannot order in its own order.
 */
function dictionaryText(reader: ByteReader, tables: VariantTables): string {
  const entries = repeat(reader.u32() & SHARED_LENGTH_MASK, () => dictionaryEntry(reader, tables));
  if (entries.length === 0) return '{}';
  sortArray(entries, (a, b) => compareKeys(a.order, b.order) < 0);
  const lines = entries.map(({ text }) => text);
  return `{\n${lines.join(',\n')}\n}`;
}

function dictionaryEntry(reader: ByteReader, tables: VariantTables): ReadVariant {
  const key = readVariant(reader, tables);
  return { text: `${key.text}: ${variantText(reader, tables)}`, order: key.order };
}

/** The `Variant::Type` of each tag. A RID loads as its int id (`:388-390`). */
const VARIANT_TYPE_OF_TAG: Readonly<Record<EnumValue<typeof VariantTag>, number>> = {
  [VariantTag.Nil]: VARIANT_TYPE.NIL,
  [VariantTag.Bool]: VARIANT_TYPE.BOOL,
  [VariantTag.Int]: VARIANT_TYPE.INT,
  [VariantTag.Int64]: VARIANT_TYPE.INT,
  [VariantTag.Float]: VARIANT_TYPE.FLOAT,
  [VariantTag.Double]: VARIANT_TYPE.FLOAT,
  [VariantTag.String]: VARIANT_TYPE.STRING,
  [VariantTag.Vector2]: VARIANT_TYPE.VECTOR2,
  [VariantTag.Vector2i]: VARIANT_TYPE.VECTOR2I,
  [VariantTag.Rect2]: VARIANT_TYPE.RECT2,
  [VariantTag.Rect2i]: VARIANT_TYPE.RECT2I,
  [VariantTag.Vector3]: VARIANT_TYPE.VECTOR3,
  [VariantTag.Vector3i]: VARIANT_TYPE.VECTOR3I,
  [VariantTag.Transform2D]: VARIANT_TYPE.TRANSFORM2D,
  [VariantTag.Vector4]: VARIANT_TYPE.VECTOR4,
  [VariantTag.Vector4i]: VARIANT_TYPE.VECTOR4I,
  [VariantTag.Plane]: VARIANT_TYPE.PLANE,
  [VariantTag.Quaternion]: VARIANT_TYPE.QUATERNION,
  [VariantTag.Aabb]: VARIANT_TYPE.AABB,
  [VariantTag.Basis]: VARIANT_TYPE.BASIS,
  [VariantTag.Transform3D]: VARIANT_TYPE.TRANSFORM3D,
  [VariantTag.Projection]: VARIANT_TYPE.PROJECTION,
  [VariantTag.Color]: VARIANT_TYPE.COLOR,
  [VariantTag.StringName]: VARIANT_TYPE.STRING_NAME,
  [VariantTag.NodePath]: VARIANT_TYPE.NODE_PATH,
  [VariantTag.Rid]: VARIANT_TYPE.INT,
  [VariantTag.Object]: VARIANT_TYPE.OBJECT,
  [VariantTag.InputEvent]: VARIANT_TYPE.OBJECT,
  [VariantTag.Callable]: VARIANT_TYPE.CALLABLE,
  [VariantTag.Signal]: VARIANT_TYPE.SIGNAL,
  [VariantTag.Dictionary]: VARIANT_TYPE.DICTIONARY,
  [VariantTag.Array]: VARIANT_TYPE.ARRAY,
  [VariantTag.PackedByteArray]: VARIANT_TYPE.PACKED_BYTE_ARRAY,
  [VariantTag.PackedInt32Array]: VARIANT_TYPE.PACKED_INT32_ARRAY,
  [VariantTag.PackedInt64Array]: VARIANT_TYPE.PACKED_INT64_ARRAY,
  [VariantTag.PackedFloat32Array]: VARIANT_TYPE.PACKED_FLOAT32_ARRAY,
  [VariantTag.PackedFloat64Array]: VARIANT_TYPE.PACKED_FLOAT64_ARRAY,
  [VariantTag.PackedStringArray]: VARIANT_TYPE.PACKED_STRING_ARRAY,
  [VariantTag.PackedVector2Array]: VARIANT_TYPE.PACKED_VECTOR2_ARRAY,
  [VariantTag.PackedVector3Array]: VARIANT_TYPE.PACKED_VECTOR3_ARRAY,
  [VariantTag.PackedColorArray]: VARIANT_TYPE.PACKED_COLOR_ARRAY,
  [VariantTag.PackedVector4Array]: VARIANT_TYPE.PACKED_VECTOR4_ARRAY,
};

/** `StringLikeVariantOrder::compare`: two string-like keys by their text, any other pair by `operator<`. */
function compareKeys(a: KeyOrder, b: KeyOrder): number {
  return a.kind === 'text' && b.kind === 'text' ? codePointOrder(a.value, b.value) : compareVariants(a, b);
}

/**
 * `Variant::operator<` (`variant.cpp:882-890`) as a three-way compare: by type, then by the type's
 * `OP_LESS`. Zero where neither is less, as for a type with no `OP_LESS`.
 */
function compareVariants(a: KeyOrder, b: KeyOrder): number {
  if (a.type !== b.type) return a.type - b.type;
  if (a.kind === 'text' && b.kind === 'text') return codePointOrder(a.value, b.value);
  if (a.kind === 'array' && b.kind === 'array') return compareArrays(a.value, b.value);
  if (a.kind === 'numbers' && b.kind === 'numbers') return compareComponents(a.value, b.value);
  return 0;
}

/** A scalar, or a vector compared component by component, stopping at the first unequal one (`vector2.h:164`). */
function compareComponents(a: readonly (number | bigint)[], b: readonly (number | bigint)[]): number {
  for (let i = 0; i < a.length; i++) {
    const left = a[i]!;
    const right = b[i]!;
    if (left !== right) return left < right ? -1 : right < left ? 1 : 0;
  }
  return 0;
}

/** `Array::operator<` (`array.cpp:164-179`): element by element, then the shorter first. */
function compareArrays(a: readonly KeyOrder[], b: readonly KeyOrder[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const order = compareVariants(a[i]!, b[i]!);
    if (order !== 0) return order;
  }
  return a.length - b.length;
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
