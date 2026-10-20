/**
 * Godot's binary resource format (`RSRC`), read into the **ParsedResource** a `.tres` parses to
 * (ADR-0031), so a decoder never learns which serialisation a file used. Each property value is
 * written as Godot's text format spells it. Ported from `ResourceLoaderBinary::open` and `::load`
 * (`core/io/resource_format_binary.cpp:982-1110`, `:681-880`).
 */

import type { ParsedResource } from '../../../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { ByteReader } from './byteReader';
import { tableString, variantText, type VariantTables } from './variants';
import {
  BINARY_RESOURCE_MAGIC,
  BinaryFormatFlag,
  COMPRESSED_BINARY_RESOURCE_MAGIC,
  LOCAL_RESOURCE_PREFIX,
  RESERVED_FIELDS,
} from '../../../godot/project/binaryResourceFormat';

/** One internal resource: its id and where its class and properties start. */
interface InternalEntry {
  id: string;
  offset: number;
}

export function parseBinaryResource(bytes: ArrayBuffer): ParsedResource {
  const reader = new ByteReader(new Uint8Array(bytes));
  readMagic(reader);
  const header = readHeader(reader);
  const strings = Array.from({ length: reader.u32() }, () => reader.unicodeString());
  const extResources = readExternalResources(reader, header.flags);
  const internals = readInternalResources(reader);
  const tables: VariantTables = {
    formatVersion: header.formatVersion,
    strings,
    externalIds: extResources.map(({ id }) => id),
    internalIds: internals.map(({ id }) => id),
  };
  const resources = internals.map(({ id, offset }) => readResource(reader, tables, id, offset));
  // The main resource is the last internal one (`:707`).
  const main = resources.pop();
  if (!main) throw new Error('expected a binary resource with at least one internal resource, got none');
  return { resourceType: main.type, properties: main.data, extResources, subResources: resources };
}

function readMagic(reader: ByteReader): void {
  const magic = String.fromCharCode(...reader.take(BINARY_RESOURCE_MAGIC.length));
  if (magic === COMPRESSED_BINARY_RESOURCE_MAGIC)
    throw new Error('expected an uncompressed binary resource, got RSCC');
  if (magic !== BINARY_RESOURCE_MAGIC)
    throw new Error(
      `expected a binary resource starting with ${BINARY_RESOURCE_MAGIC}, got ${JSON.stringify(magic)}`
    );
}

/** `:1021-1069`: byte order, `real_t` width, versions, the class, the flags and the reserved fields. */
function readHeader(reader: ByteReader): { formatVersion: number; flags: number } {
  reader.isLittleEndian = reader.u32() === 0;
  reader.u32(); // `use_real64`, which the flags below supersede
  reader.u32(); // engine major version
  reader.u32(); // engine minor version
  const formatVersion = reader.u32();
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

/** `:1103-1109`: each internal resource's path and offset. An old file numbers them instead. */
function readInternalResources(reader: ByteReader): InternalEntry[] {
  return Array.from({ length: reader.u32() }, (_, index) => {
    const path = reader.unicodeString();
    const offset = Number(reader.u64());
    return {
      id: path.startsWith(LOCAL_RESOURCE_PREFIX)
        ? path.slice(LOCAL_RESOURCE_PREFIX.length)
        : String(index + 1),
      offset,
    };
  });
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
    data[name] = variantText(reader, tables);
  }
  return { id, type, data };
}
