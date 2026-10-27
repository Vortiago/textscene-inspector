/**
 * Reads the tables of a WOFF 2.0 file (W3C WOFF 2.0, §"WOFF2 Header", §"Table directory" and
 * §"Compressed data format"): one Brotli stream holding every table, end to end. A table that the
 * format transforms (`glyf`, `loca`, `hmtx`) stays out, as the readers need none of them.
 */

import { loadBrotliDecoder } from './brotliDecoder';
import { SCENE_FONT_TABLE_TAGS, sfntFileOfTables, type SfntFile } from './sfntTables';

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

/** A forward cursor over big-endian bytes. */
class Cursor {
  position: number;
  private readonly bytes: Uint8Array;

  constructor(bytes: Uint8Array, position: number) {
    this.bytes = bytes;
    this.position = position;
  }

  u8(): number {
    const value = this.bytes[this.position++];
    if (value === undefined) throw new RangeError('expected a byte, got the end of the file');
    return value;
  }

  tag(): string {
    return String.fromCharCode(this.u8(), this.u8(), this.u8(), this.u8());
  }

  base128(): number {
    let accumulated = 0;
    for (let index = 0; index < BASE128_MAX_BYTES; index++) {
      const byte = this.u8();
      if (index === 0 && byte === 0x80) throw new Error('expected a UIntBase128 with no leading zero');
      if (accumulated > BASE128_OVERFLOW_LIMIT) throw new Error('expected a UIntBase128 within 32 bits');
      accumulated = accumulated * 128 + (byte & 0x7f);
      if ((byte & 0x80) === 0) return accumulated;
    }
    throw new Error(`expected a UIntBase128 of at most ${BASE128_MAX_BYTES} bytes`);
  }
}

/** `glyf` and `loca` are transformed at version 0 and plain at version 3; every other table is plain at version 0. */
function isTransformedTable(tag: string, version: number): boolean {
  return tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
}

function readDirectoryEntry(cursor: Cursor): DirectoryEntry {
  const flags = cursor.u8();
  const tagIndex = flags & TAG_INDEX_MASK;
  const tag = tagIndex === ARBITRARY_TAG_INDEX ? cursor.tag() : KNOWN_TAGS[tagIndex];
  if (tag === undefined) throw new RangeError(`expected a known table tag index, got ${tagIndex}`);
  const isTransformed = isTransformedTable(tag, flags >> TRANSFORM_VERSION_SHIFT);
  const originalLength = cursor.base128();
  return { tag, isTransformed, storedLength: isTransformed ? cursor.base128() : originalLength };
}

/** Throws on a collection, a directory or stream that does not fit `bytes`, or a Brotli stream that does not decode to the lengths the directory sums to. */
export async function readWoff2Tables(bytes: ArrayBuffer): Promise<SfntFile> {
  const dv = new DataView(bytes);
  if (dv.getUint32(FLAVOR_OFFSET, false) === SFNT_COLLECTION_FLAVOR) {
    throw new Error('expected a single-font .woff2, got a font collection');
  }
  const cursor = new Cursor(new Uint8Array(bytes), WOFF2_HEADER_SIZE);
  const entries = Array.from({ length: dv.getUint16(NUM_TABLES_OFFSET, false) }, () =>
    readDirectoryEntry(cursor)
  );

  const decodedLength = entries.reduce((sum, entry) => sum + entry.storedLength, 0);
  const compressed = new Uint8Array(
    bytes,
    cursor.position,
    dv.getUint32(TOTAL_COMPRESSED_SIZE_OFFSET, false)
  );
  const decode = await loadBrotliDecoder();
  const decoded = decode(compressed, decodedLength);
  if (decoded.length !== decodedLength) {
    throw new Error(`expected ${decodedLength} decoded bytes, got ${decoded.length}`);
  }

  const tables = new Map<string, Uint8Array>();
  let offset = 0;
  for (const { tag, storedLength, isTransformed } of entries) {
    if (!isTransformed && SCENE_FONT_TABLE_TAGS.includes(tag)) {
      tables.set(tag, decoded.subarray(offset, offset + storedLength));
    }
    offset += storedLength;
  }
  return sfntFileOfTables(tables);
}
