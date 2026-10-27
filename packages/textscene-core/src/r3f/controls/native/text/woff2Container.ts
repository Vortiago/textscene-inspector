/**
 * Reads the tables of a WOFF 2.0 file (W3C WOFF 2.0, §"WOFF2 Header", §"Table directory" and
 * §"Compressed data format"): one Brotli stream holding every table, end to end. A transformed
 * `glyf` and `loca` are rebuilt (`woff2Glyf.ts`), and the other transformed table, `hmtx`, stays out:
 * no reader needs it.
 */

import { ByteReader } from '../../../../resources/formats/binaryresource/byteReader';
import { loadBrotliDecoder } from './brotliDecoder';
import { SCENE_FONT_TABLE_TAGS, sfntFileOfTables, type SfntFile } from './sfntTables';
import { rebuildGlyfTables } from './woff2Glyf';

export const WOFF2_SIGNATURE = 0x774f4632; // 'wOF2'
const SFNT_COLLECTION_FLAVOR = 0x74746366; // 'ttcf'
const WOFF2_HEADER_SIZE = 48;
const FLAVOR_OFFSET = 4;
const NUM_TABLES_OFFSET = 12;
const TOTAL_COMPRESSED_SIZE_OFFSET = 20;

// Table directory flags byte: tag index in bits 0-5, transform version in bits 6-7.
const TAG_INDEX_MASK = 0x3f;
const TRANSFORM_VERSION_SHIFT = 6;
const ARBITRARY_TAG_INDEX = 63; // the tag follows as four bytes
const TAG_SIZE = 4;

/** The "Known Table Tags" of the WOFF2 spec, by tag index. */
const KNOWN_TAGS = [
  'cmap',
  'head',
  'hhea',
  'hmtx',
  'maxp',
  'name',
  'OS/2',
  'post',
  'cvt ',
  'fpgm',
  'glyf',
  'loca',
  'prep',
  'CFF ',
  'VORG',
  'EBDT',
  'EBLC',
  'gasp',
  'hdmx',
  'kern',
  'LTSH',
  'PCLT',
  'VDMX',
  'vhea',
  'vmtx',
  'BASE',
  'GDEF',
  'GPOS',
  'GSUB',
  'EBSC',
  'JSTF',
  'MATH',
  'CBDT',
  'CBLC',
  'COLR',
  'CPAL',
  'SVG ',
  'sbix',
  'acnt',
  'avar',
  'bdat',
  'bloc',
  'bsln',
  'cvar',
  'fdsc',
  'feat',
  'fmtx',
  'fvar',
  'gvar',
  'hsty',
  'just',
  'lcar',
  'mort',
  'morx',
  'opbd',
  'prop',
  'trak',
  'Zapf',
  'Silf',
  'Glat',
  'Gloc',
  'Feat',
  'Sill',
] as const;

/** `UIntBase128`: seven bits per byte, high bit set while more follow, at most five bytes and 32 bits. */
const BASE128_MAX_BYTES = 5;
const BASE128_OVERFLOW_LIMIT = 0x01ffffff;

interface DirectoryEntry {
  tag: string;
  /** The bytes the table takes in the decoded stream. */
  storedLength: number;
  isTransformed: boolean;
}

function readBase128(reader: ByteReader): number {
  let accumulated = 0;
  for (let index = 0; index < BASE128_MAX_BYTES; index++) {
    const byte = reader.u8();
    if (index === 0 && byte === 0x80) throw new Error('expected a UIntBase128 with no leading zero');
    if (accumulated > BASE128_OVERFLOW_LIMIT) throw new Error('expected a UIntBase128 within 32 bits');
    accumulated = accumulated * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return accumulated;
  }
  throw new Error(`expected a UIntBase128 of at most ${BASE128_MAX_BYTES} bytes`);
}

/** `glyf` and `loca` are transformed at version 0 and plain at version 3; every other table is plain at version 0. */
function isTransformedTable(tag: string, version: number): boolean {
  return tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
}

function readDirectoryEntry(reader: ByteReader): DirectoryEntry {
  const flags = reader.u8();
  const tagIndex = flags & TAG_INDEX_MASK;
  const tag =
    tagIndex === ARBITRARY_TAG_INDEX ? String.fromCharCode(...reader.take(TAG_SIZE)) : KNOWN_TAGS[tagIndex];
  if (tag === undefined) throw new RangeError(`expected a known table tag index, got ${tagIndex}`);
  const isTransformed = isTransformedTable(tag, flags >> TRANSFORM_VERSION_SHIFT);
  const originalLength = readBase128(reader);
  return { tag, isTransformed, storedLength: isTransformed ? readBase128(reader) : originalLength };
}

/**
 * The `glyf` and `loca` that the transformed `glyf` holds. The `loca` is stored with a length of 0,
 * so the transformed `glyf` is the one place the pair comes from.
 */
function setRebuiltGlyfTables(tables: Map<string, Uint8Array>, transformedGlyf: Uint8Array): void {
  const { glyf, loca } = rebuildGlyfTables(transformedGlyf);
  tables.set('glyf', glyf);
  tables.set('loca', loca);
}

/** Written only by `readWoff2Tables`. The metrics and the outlines of a scene font read one buffer, which Brotli decodes once. */
const decodedStreams = new WeakMap<ArrayBuffer, Promise<Uint8Array>>();

async function decodeStream(compressed: Uint8Array, decodedLength: number): Promise<Uint8Array> {
  const decode = await loadBrotliDecoder();
  const decoded = decode(compressed, decodedLength);
  if (decoded.length !== decodedLength) {
    throw new Error(`expected ${decodedLength} decoded bytes, got ${decoded.length}`);
  }
  return decoded;
}

/** Throws on a collection, a directory or stream that does not fit `bytes`, or a Brotli stream that does not decode to the lengths the directory sums to. */
export async function readWoff2Tables(
  bytes: ArrayBuffer,
  tags: readonly string[] = SCENE_FONT_TABLE_TAGS
): Promise<SfntFile> {
  const dv = new DataView(bytes);
  if (dv.getUint32(FLAVOR_OFFSET, false) === SFNT_COLLECTION_FLAVOR) {
    throw new Error('expected a single-font .woff2, got a font collection');
  }
  const reader = new ByteReader(new Uint8Array(bytes));
  reader.isLittleEndian = false;
  reader.seek(WOFF2_HEADER_SIZE);
  const entries = Array.from({ length: dv.getUint16(NUM_TABLES_OFFSET, false) }, () =>
    readDirectoryEntry(reader)
  );

  const decodedLength = entries.reduce((sum, entry) => sum + entry.storedLength, 0);
  const compressed = reader.take(dv.getUint32(TOTAL_COMPRESSED_SIZE_OFFSET, false));
  let decoding = decodedStreams.get(bytes);
  if (!decoding) {
    decoding = decodeStream(compressed, decodedLength);
    decodedStreams.set(bytes, decoding);
  }
  const decoded = await decoding;

  const tables = new Map<string, Uint8Array>();
  let offset = 0;
  for (const { tag, storedLength, isTransformed } of entries) {
    const stored = decoded.subarray(offset, offset + storedLength);
    if (tag === 'glyf' && isTransformed && tags.includes('glyf')) setRebuiltGlyfTables(tables, stored);
    else if (!isTransformed && tags.includes(tag)) tables.set(tag, stored);
    offset += storedLength;
  }
  return sfntFileOfTables(tables);
}
