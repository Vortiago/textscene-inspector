/**
 * One Variant of a binary resource, read as `ResourceLoaderBinary::parse_variant` reads it
 * (`core/io/resource_format_binary.cpp:173-678`) and written as Godot's text format spells it
 * (`VariantWriter::write`, `core/variant/variant_parser.cpp`).
 */

import { stringLiteral } from '../../../godot/string/string';
import { componentLiteral, floatLiteral } from '../../../godot/variant/variantWriter';
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
    case Tag.StringName:
      return stringLikeText(tag === Tag.StringName, reader.unicodeString());
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
    case Tag.Rid:
      reader.u32();
      return 'RID()';
    case Tag.Object:
      return objectText(reader, tables);
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

/** `:453-548`: a resource the property names by index, or by type and path in an old file. */
function objectText(reader: ByteReader, tables: VariantTables): string {
  const kind = reader.u32() as ObjectRef;
  switch (kind) {
    case ObjectRef.Empty:
      return 'null';
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

function stringLikeText(isStringName: boolean, value: string): string {
  return isStringName ? `&${stringLiteral(value)}` : stringLiteral(value);
}

/** One dictionary entry, with its key as a string when the key is a String or a StringName. */
interface DictionaryEntry {
  text: string;
  name: string | null;
}

type NamedEntry = DictionaryEntry & { name: string };

/**
 * `:582-597`. Godot's writer puts each entry on its own line and sorts string keys by code point
 * (`variant_parser.cpp:2306-2307`, `variant.cpp:3409-3428`). A dictionary with another key keeps
 * the file's order, as every reader here looks a key up by name.
 */
function dictionaryText(reader: ByteReader, tables: VariantTables): string {
  const entries = repeat(reader.u32() & SHARED_LENGTH_MASK, () => dictionaryEntry(reader, tables));
  if (entries.length === 0) return '{}';
  const lines = writtenOrder(entries).map(({ text }) => text);
  return `{\n${lines.join(',\n')}\n}`;
}

function writtenOrder(entries: DictionaryEntry[]): DictionaryEntry[] {
  const named = entries.filter((entry): entry is NamedEntry => entry.name !== null);
  return named.length === entries.length ? named.sort((a, b) => codePointOrder(a.name, b.name)) : entries;
}

function dictionaryEntry(reader: ByteReader, tables: VariantTables): DictionaryEntry {
  const tag = reader.u32() as Tag;
  const name = tag === Tag.String || tag === Tag.StringName ? reader.unicodeString() : null;
  const key =
    name === null ? taggedVariantText(tag, reader, tables) : stringLikeText(tag === Tag.StringName, name);
  return { text: `${key}: ${variantText(reader, tables)}`, name };
}

/** `String`'s `operator<`: code point by code point, which UTF-16 order breaks above U+FFFF. */
function codePointOrder(a: string, b: string): number {
  const left = [...a];
  const right = [...b];
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const delta = left[i]!.codePointAt(0)! - right[i]!.codePointAt(0)!;
    if (delta !== 0) return delta;
  }
  return left.length - right.length;
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
