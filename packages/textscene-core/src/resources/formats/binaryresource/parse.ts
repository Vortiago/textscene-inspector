/**
 * Godot's binary resource format (`RSRC`, or `RSCC` compressed), read into the **ParsedResource**
 * a `.tres` parses to (ADR-0031), so a decoder never learns which serialisation a file used. Each
 * property value is written as Godot's text format spells it. Ported from
 * `ResourceLoaderBinary::open` and `::load` (`core/io/resource_format_binary.cpp:982-1110`, `:681-880`).
 */

import type { ParsedResource } from '../../../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { ByteReader } from './byteReader';
import { inflateCompressedStream } from './compressedStream';
import { propertyValueText, tableString, type VariantTables } from './variants';
import { typedCollectionPrefix } from '../../../godot/classdb/typedCollection';
import { VARIANT_PROPERTIES } from '../../../godot/classdb/variantProperties.generated';
import {
  BINARY_FORMAT_VERSION,
  BINARY_RESOURCE_MAGIC,
  BinaryFormatFlag,
  COMPRESSED_BINARY_RESOURCE_MAGIC,
  ENGINE_MAJOR_VERSION,
  LOCAL_RESOURCE_PREFIX,
  RESERVED_FIELDS,
  SUB_RESOURCE_SEPARATOR,
} from '../../../godot/project/binaryResourceFormat';

/** One internal resource: its id and where its class and properties start. */
interface InternalEntry {
  id: string;
  offset: number;
}

/**
 * A compressed file's offsets count from the start of its inflated stream, which holds no magic,
 * and a plain file's from the start of the file (`resource_format_binary.cpp:987-1004`).
 */
export async function parseBinaryResource(bytes: ArrayBuffer): Promise<ParsedResource> {
  const file = new ByteReader(new Uint8Array(bytes));
  const magic = String.fromCharCode(...file.take(BINARY_RESOURCE_MAGIC.length));
  if (magic === COMPRESSED_BINARY_RESOURCE_MAGIC)
    return parseStream(new ByteReader(await inflateCompressedStream(file)));
  if (magic !== BINARY_RESOURCE_MAGIC)
    throw new Error(
      `expected a binary resource starting with ${BINARY_RESOURCE_MAGIC}, got ${JSON.stringify(magic)}`
    );
  return parseStream(file);
}

/** The resource from `reader`, which stands where the stream after the magic starts. */
function parseStream(reader: ByteReader): ParsedResource {
  const header = readHeader(reader);
  const strings = Array.from({ length: reader.u32() }, () => reader.unicodeString());
  const extResources = readExternalResources(reader, header.flags);
  const internals = readInternalResources(reader);
  const tables: VariantTables = {
    formatVersion: header.formatVersion,
    strings,
    externalIds: extResources.map(({ id }) => id),
    internalIds: internals.map(({ id }) => id),
    hasNamedIds: (header.flags & BinaryFormatFlag.NamedSceneIds) !== 0,
  };
  const resources = internals.map(({ id, offset }) => readResource(reader, tables, id, offset));
  // The main resource is the last internal one (`:707`).
  const main = resources.pop();
  if (!main) throw new Error('expected a binary resource with at least one internal resource, got none');
  return { resourceType: main.type, properties: main.data, extResources, subResources: resources };
}

/** `:1021-1069`: byte order, `real_t` width, versions, the class, the flags and the reserved fields. */
function readHeader(reader: ByteReader): { formatVersion: number; flags: number } {
  reader.isLittleEndian = reader.u32() === 0;
  reader.u32(); // `use_real64`, which the flags below supersede
  const engineMajor = reader.u32();
  reader.u32(); // engine minor version
  const formatVersion = reader.u32();
  if (formatVersion > BINARY_FORMAT_VERSION) {
    throw new Error(`expected a binary format version up to ${BINARY_FORMAT_VERSION}, got ${formatVersion}`);
  }
  if (engineMajor > ENGINE_MAJOR_VERSION) {
    throw new Error(
      `expected a file saved by Godot ${ENGINE_MAJOR_VERSION} or older, got Godot ${engineMajor}`
    );
  }
  reader.unicodeString(); // the main resource's class, which its own entry repeats
  reader.u64(); // the import metadata offset
  const flags = reader.u32();
  reader.isRealDouble = (flags & BinaryFormatFlag.RealTIsDouble) !== 0;
  reader.u64(); // the file's own uid, or an unused field
  if (flags & BinaryFormatFlag.HasScriptClass) reader.unicodeString();
  for (let i = 0; i < RESERVED_FIELDS; i++) reader.u32();
  return { formatVersion, flags };
}

/** `:1077-1101`: each external resource's type and path, numbered from 1 as its text id. */
function readExternalResources(reader: ByteReader, flags: number): TscnExternalResource[] {
  return Array.from({ length: reader.u32() }, (_, index) => {
    const type = reader.unicodeString();
    const path = reader.unicodeString();
    if (flags & BinaryFormatFlag.Uids) reader.u64();
    return { id: String(index + 1), path, type };
  });
}

/**
 * `:1103-1109`: each internal resource's path and offset. A named-ids file writes `local://<id>`,
 * and an older one `<path>::<number>` (`:716-724`).
 */
function readInternalResources(reader: ByteReader): InternalEntry[] {
  return Array.from({ length: reader.u32() }, () => {
    const path = reader.unicodeString();
    const offset = Number(reader.u64());
    return { id: internalIdOf(path), offset };
  });
}

function internalIdOf(path: string): string {
  if (path.startsWith(LOCAL_RESOURCE_PREFIX)) return path.slice(LOCAL_RESOURCE_PREFIX.length);
  return path.slice(path.lastIndexOf(SUB_RESOURCE_SEPARATOR) + SUB_RESOURCE_SEPARATOR.length);
}

/** `:752-830`: the class at `offset`, then each property as a table name and a variant. */
function readResource(
  reader: ByteReader,
  tables: VariantTables,
  id: string,
  offset: number
): TscnInternalResource {
  reader.seek(offset);
  const type = reader.unicodeString();
  const data: Record<string, string> = {};
  const propertyCount = reader.u32();
  for (let i = 0; i < propertyCount; i++) {
    const name = tableString(reader, tables);
    const value = propertyValueText(reader, tables);
    if (value !== null && !isEmptyObject(type, name, value)) data[name] = typedText(type, name, value);
    else if (isStoredWhenNull(type, name)) data[name] = 'null';
  }
  return { id, type, data };
}

/**
 * Whether a Nil is an empty Object, which the text saver leaves out (`resource_format_text.cpp:1980`).
 * Only a property declared as a Variant keeps a Nil. A getter such as `get_script` returns Nil for
 * an empty Object (`object.cpp:470-475`).
 */
function isEmptyObject(type: string, name: string, value: string): boolean {
  return value === 'null' && !isVariantProperty(type, name);
}

function isVariantProperty(type: string, name: string): boolean {
  return Object.hasOwn(VARIANT_PROPERTIES, type) && VARIANT_PROPERTIES[type]!.includes(name);
}

/**
 * The value with the `Array[T]` or `Dictionary[K, V]` prefix of a typed property. The file stores
 * no element type: the loader types the value as the property's getter types it (`:846-868`).
 */
function typedText(type: string, name: string, value: string): string {
  if (!isCollectionText(value)) return value;
  const prefix = typedCollectionPrefix(type, name);
  return prefix === undefined ? value : `${prefix}(${value})`;
}

function isCollectionText(value: string): boolean {
  return value.startsWith('[') || value.startsWith('{');
}

/** A Theme's icon, style and font items carry `PROPERTY_USAGE_STORE_IF_NULL` (`theme.cpp:123-137`). */
const THEME_ITEM_STORED_WHEN_NULL = /^[^/]+\/(icons|styles|fonts)\/[^/]+$/;

function isStoredWhenNull(type: string, name: string): boolean {
  return type === 'Theme' && THEME_ITEM_STORED_WHEN_NULL.test(name);
}
