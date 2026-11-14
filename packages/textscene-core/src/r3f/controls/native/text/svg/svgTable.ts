/**
 * The `SVG ` table as FreeType reads it (`ttsvg.c`): its document list, and the document that holds
 * a glyph, inflated where it is gzip-compressed.
 */
import { bytesView } from '../../../../../utils/bytesView';
import { perObject } from '../../../../../utils/perObject';
import { tableBytes, type SfntFile } from '../sfntTables';

/** `SVG_TABLE_HEADER_SIZE`, `SVG_DOCUMENT_RECORD_SIZE` and `SVG_DOCUMENT_LIST_MINIMUM_SIZE` (`ttsvg.c:42-48`). */
const HEADER_SIZE = 10;
const RECORD_SIZE = 12;
const LIST_MINIMUM_SIZE = 2 + RECORD_SIZE;
/** `MAX_SVG_SIZE` (`ttsvg.c:50`): the largest inflated document FreeType takes. */
const MAX_SVG_SIZE = 1 << 26;
/** The gzip magic and its deflate method (`ttsvg.c:353-356`). */
const GZIP_HEADER = [0x1f, 0x8b, 0x08] as const;
/** A compressed document is longer than this before FreeType inflates it. */
const GZIP_MINIMUM_LENGTH = 6;

/** The document list of a face's `SVG ` table. */
export interface SvgTable {
  readonly table: Uint8Array;
  /** The bytes from the document list to the end of the table, which a record's offset counts from. */
  readonly list: Uint8Array;
  readonly entryCount: number;
}

/** A glyph's document, and the glyphs it covers. */
export interface SvgDocument {
  readonly bytes: Uint8Array;
  readonly startGlyph: number;
  readonly endGlyph: number;
  /** The same object for every read of one stored document, so a parse of it is kept: a new one for a compressed document. */
  readonly key: object;
}

export type GzipInflate = (stream: Uint8Array) => Uint8Array;

/** The face's `SVG ` table, or null where FreeType loads none (`tt_face_load_svg`). */
export function readSvgTable(sfnt: SfntFile): SvgTable | null {
  const table = tableBytes(sfnt, 'SVG ');
  if (table.length < HEADER_SIZE + LIST_MINIMUM_SIZE) return null;
  const view = bytesView(table);
  const listOffset = view.getUint32(2);
  if (listOffset < HEADER_SIZE || listOffset > table.length - LIST_MINIMUM_SIZE) return null;
  const entryCount = view.getUint16(listOffset);
  if (listOffset + 2 + entryCount * RECORD_SIZE > table.length) return null;
  return { table, list: table.subarray(listOffset), entryCount };
}

/** The keys of a table's documents, by the offset of each in its list. */
const documentKeys = perObject((_table: SvgTable) => new Map<number, object>());

/**
 * The document of `glyph`, or null for a glyph no record covers, a record past the table, or a
 * document that does not inflate (`tt_face_load_svg_doc`).
 */
export function svgDocumentOf(table: SvgTable, glyph: number, inflate: GzipInflate): SvgDocument | null {
  const record = findRecord(table, glyph);
  if (!record) return null;
  const { list } = table;
  if (record.offset > list.length || record.length > list.length - record.offset) return null;
  const stored = list.subarray(record.offset, record.offset + record.length);
  if (isGzip(stored)) {
    // Godot keys its parse by the document's address, and FreeType inflates each load into a new buffer.
    const bytes = inflated(stored, inflate);
    return bytes && { bytes, startGlyph: record.startGlyph, endGlyph: record.endGlyph, key: {} };
  }
  const keys = documentKeys(table);
  let key = keys.get(record.offset);
  if (!key) keys.set(record.offset, (key = {}));
  return { bytes: stored, startGlyph: record.startGlyph, endGlyph: record.endGlyph, key };
}

interface SvgRecord {
  readonly startGlyph: number;
  readonly endGlyph: number;
  readonly offset: number;
  readonly length: number;
}

function recordAt({ list }: SvgTable, index: number): SvgRecord {
  const view = bytesView(list);
  const at = 2 + index * RECORD_SIZE;
  return {
    startGlyph: view.getUint16(at),
    endGlyph: view.getUint16(at + 2),
    offset: view.getUint32(at + 4),
    length: view.getUint32(at + 8),
  };
}

/** `compare_svg_doc`: -1 where `glyph` precedes the record's range, 1 where it follows it. */
function compare({ startGlyph, endGlyph }: SvgRecord, glyph: number): number {
  if (glyph < startGlyph) return -1;
  return glyph > endGlyph ? 1 : 0;
}

/** `find_doc` (`ttsvg.c:214-280`): a binary search over records sorted by glyph. */
function findRecord(table: SvgTable, glyph: number): SvgRecord | null {
  if (table.entryCount === 0) return null;
  let start = 0;
  let end = table.entryCount - 1;
  if (compare(recordAt(table, start), glyph) === -1 || compare(recordAt(table, end), glyph) === 1)
    return null;
  while (start <= end) {
    const middle = Math.trunc((start + end) / 2);
    const record = recordAt(table, middle);
    const order = compare(record, glyph);
    if (order === 0) return record;
    if (order === 1) start = middle + 1;
    else end = middle - 1;
  }
  return null;
}

function isGzip(stored: Uint8Array): boolean {
  return stored.length > GZIP_MINIMUM_LENGTH && GZIP_HEADER.every((byte, i) => stored[i] === byte);
}

/** The inflated document, or null for one whose stated size is too large or that does not inflate. */
function inflated(stored: Uint8Array, inflate: GzipInflate): Uint8Array | null {
  const view = bytesView(stored);
  if (view.getUint32(stored.length - 4, true) >= MAX_SVG_SIZE) return null;
  try {
    return inflate(stored);
  } catch {
    // FreeType turns a failed inflate into Invalid_Table, and the glyph loads its outline instead.
    return null;
  }
}
