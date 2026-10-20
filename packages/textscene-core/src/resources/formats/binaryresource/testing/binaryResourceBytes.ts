/**
 * Builds a binary resource file as `ResourceFormatSaverBinaryInstance` lays one out
 * (`core/io/resource_format_binary.cpp`), so a test sets each header field the reader branches on.
 */

import {
  BINARY_FORMAT_VERSION,
  BINARY_RESOURCE_MAGIC,
  BinaryFormatFlag,
  LOCAL_RESOURCE_PREFIX,
  RESERVED_FIELDS,
} from '../../../../godot/project/binaryResourceFormat';

/** One property: a name from the string table, then its variant's own bytes. */
interface BinaryProperty {
  name: string;
  variant: Uint8Array;
}

interface BinaryResourceEntry {
  /** `local://<id>`, as a named-ids file writes it. */
  id: string;
  type: string;
  properties: BinaryProperty[];
}

export interface BinaryResourceLayout {
  isBigEndian?: boolean;
  isRealDouble?: boolean;
  scriptClass?: string;
  strings: string[];
  externals?: { type: string; path: string }[];
  /** The last one is the main resource. */
  resources: BinaryResourceEntry[];
}

/** The engine version the header records, which the reader skips. */
const ENGINE_MAJOR = 4;
const ENGINE_MINOR = 6;

/** Little or big endian bytes, appended in order. */
export class ByteWriter {
  private readonly chunks: number[] = [];

  constructor(private readonly isBigEndian = false) {}

  get length(): number {
    return this.chunks.length;
  }

  u16(value: number): this {
    return this.fixed(2, (view) => view.setUint16(0, value, !this.isBigEndian));
  }

  u32(value: number): this {
    return this.fixed(4, (view) => view.setUint32(0, value >>> 0, !this.isBigEndian));
  }

  u64(value: number): this {
    return this.fixed(8, (view) => view.setBigUint64(0, BigInt(value), !this.isBigEndian));
  }

  f32(value: number): this {
    return this.fixed(4, (view) => view.setFloat32(0, value, !this.isBigEndian));
  }

  f64(value: number): this {
    return this.fixed(8, (view) => view.setFloat64(0, value, !this.isBigEndian));
  }

  /** `save_unicode_string`: the UTF-8 bytes and their NUL, behind their count. */
  unicodeString(text: string): this {
    const bytes = new TextEncoder().encode(`${text}\0`);
    this.u32(bytes.length);
    return this.raw(bytes);
  }

  raw(bytes: Uint8Array): this {
    this.chunks.push(...bytes);
    return this;
  }

  bytes(): Uint8Array<ArrayBuffer> {
    return new Uint8Array(this.chunks);
  }

  private fixed(size: number, write: (view: DataView) => void): this {
    const buffer = new ArrayBuffer(size);
    write(new DataView(buffer));
    return this.raw(new Uint8Array(buffer));
  }
}

/** The whole file. Offsets are patched in once each resource's position is known. */
export function binaryResourceBytes(layout: BinaryResourceLayout): ArrayBuffer {
  const writer = new ByteWriter(layout.isBigEndian);
  const main = layout.resources[layout.resources.length - 1]!;
  writer.raw(new TextEncoder().encode(BINARY_RESOURCE_MAGIC));
  writer
    .u32(layout.isBigEndian ? 1 : 0)
    .u32(layout.isRealDouble ? 1 : 0)
    .u32(ENGINE_MAJOR)
    .u32(ENGINE_MINOR)
    .u32(BINARY_FORMAT_VERSION);
  writer.unicodeString(main.type).u64(0);
  let flags = BinaryFormatFlag.NamedSceneIds | BinaryFormatFlag.Uids;
  if (layout.isRealDouble) flags |= BinaryFormatFlag.RealTIsDouble;
  if (layout.scriptClass !== undefined) flags |= BinaryFormatFlag.HasScriptClass;
  writer.u32(flags).u64(0);
  if (layout.scriptClass !== undefined) writer.unicodeString(layout.scriptClass);
  for (let i = 0; i < RESERVED_FIELDS; i++) writer.u32(0);
  writer.u32(layout.strings.length);
  for (const text of layout.strings) writer.unicodeString(text);
  const externals = layout.externals ?? [];
  writer.u32(externals.length);
  for (const { type, path } of externals) writer.unicodeString(type).unicodeString(path).u64(0);
  const bodies = layout.resources.map((resource) => resourceBody(resource, layout));
  writer.u32(layout.resources.length);
  const tableBytes = layout.resources.reduce(
    (size, { id }) => size + 4 + utf8Size(`${LOCAL_RESOURCE_PREFIX}${id}\0`) + 8,
    0
  );
  let offset = writer.length + tableBytes;
  layout.resources.forEach(({ id }, i) => {
    writer.unicodeString(`${LOCAL_RESOURCE_PREFIX}${id}`).u64(offset);
    offset += bodies[i]!.length;
  });
  for (const body of bodies) writer.raw(body);
  return writer.bytes().buffer;
}

function resourceBody(resource: BinaryResourceEntry, layout: BinaryResourceLayout): Uint8Array {
  const writer = new ByteWriter(layout.isBigEndian)
    .unicodeString(resource.type)
    .u32(resource.properties.length);
  for (const { name, variant } of resource.properties) {
    const index = layout.strings.indexOf(name);
    if (index === -1)
      throw new Error(`expected "${name}" in the string table, got ${layout.strings.join(', ')}`);
    writer.u32(index).raw(variant);
  }
  return writer.bytes();
}

function utf8Size(text: string): number {
  return new TextEncoder().encode(text).length;
}
