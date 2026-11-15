/**
 * Whether FreeType opens the bytes of a font file as a face, as `FT_Open_Face` decides when Godot
 * builds the cache of a `FontFile` (`text_server_adv.cpp:1466-1476`). Godot draws no text in a font
 * it cannot open. Line cites are FreeType 2.14.3, the version Godot 4.6.3 vendors.
 */
import { lazyFontContainer } from './fontContainer';
import { readTag, type SfntFile, type TableRecord } from './sfntTables';

const TAG_TRUETYPE_1 = 0x00010000;
const TAG_TRUETYPE_2 = 0x00020000;
const TAG_TTCF = 0x74746366; // 'ttcf'
const TAG_OTTO = 0x4f54544f; // 'OTTO'
const TAG_TRUE = 0x74727565; // 'true'
const TAG_TYP1 = 0x74797031; // 'typ1'
const TAG_A5KBD = 0xa56b6264; // 0xA5 'kbd'
const TAG_A5LST = 0xa56c7374; // 0xA5 'lst'
const TAG_WOFF = 0x774f4646; // 'wOFF'
const TAG_WOF2 = 0x774f4632; // 'wOF2'

/** The format tags `sfnt_open_font` reads as an sfnt (`sfobjs.c:426-436`). */
const SFNT_TAGS: ReadonlySet<number> = new Set([
  TAG_TRUETYPE_1,
  TAG_TTCF,
  TAG_OTTO,
  TAG_TRUE,
  TAG_TYP1,
  TAG_A5KBD,
  TAG_A5LST,
  TAG_TRUETYPE_2,
]);

/** The `head` or `bhed` table is 0x36 bytes; a shorter one is missing (`ttload.c:260-266`). */
const HEAD_MIN_LENGTH = 0x36;
/** `head.unitsPerEm` lies outside this range in a face `sfnt_load_face` refuses (`sfobjs.c:910-916`). */
const MIN_UNITS_PER_EM = 16;
const MAX_UNITS_PER_EM = 16384;
/** The frame `tt_face_load_hhea` reads, for `hhea` and `vhea` alike (`ttmtx.c:141`). */
const METRICS_HEADER_LENGTH = 36;
const SFNT_HEADER_LENGTH = 12;
const TABLE_RECORD_LENGTH = 16;

/** True when FreeType opens `bytes` as a face: an sfnt through its own checks, any other format by its driver's header. */
export async function freeTypeOpensFace(bytes: ArrayBuffer): Promise<boolean> {
  if (bytes.byteLength < 4) return false;
  const tag = new DataView(bytes).getUint32(0, false);
  if (tag === TAG_WOFF || tag === TAG_WOF2) return opensWoff(bytes);
  if (SFNT_TAGS.has(tag)) return opensSfnt(new DataView(bytes));
  return hasOtherDriverHeader(new Uint8Array(bytes));
}

/** `woff_open_font` and `woff2_open_font` rebuild the sfnt, then `sfnt_load_face` reads it (`sfobjs.c:388-422`). */
async function opensWoff(bytes: ArrayBuffer): Promise<boolean> {
  const sfnt = (await lazyFontContainer(bytes, LOADED_TABLE_TAGS))();
  // The `flavor` field of both headers holds the format tag of the sfnt inside.
  return sfnt !== null && loadsFace(sfnt, new DataView(bytes).getUint32(4, false));
}

/** The tables `sfnt_load_face` loads before it can fail, and the outline tables it looks for. */
const LOADED_TABLE_TAGS: readonly string[] = [
  'head',
  'bhed',
  'hhea',
  'hmtx',
  'vhea',
  'glyf',
  'CFF ',
  'CFF2',
  'sbix',
];

/** A plain sfnt or the first face of a collection, through `sfnt_open_font` and `tt_face_load_font_dir`. */
function opensSfnt(dv: DataView): boolean {
  const start = faceStart(dv);
  if (start === null || start + SFNT_HEADER_LENGTH > dv.byteLength) return false;
  const formatTag = dv.getUint32(start, false);
  const tables = validTables(dv, start);
  if (tables.size === 0) return false;
  if (formatTag !== TAG_OTTO && !hasHeadTable(tables)) return false;
  return loadsFace({ dv, tables }, formatTag);
}

/** The offset of face 0: a collection of no faces opens none (`sfobjs.c:448-470`). */
function faceStart(dv: DataView): number | null {
  if (dv.getUint32(0, false) !== TAG_TTCF) return 0;
  if (dv.byteLength < 16 || dv.getUint32(8, false) === 0) return null;
  const start = dv.getUint32(12, false);
  return SFNT_TAGS.has(start + 4 <= dv.byteLength ? dv.getUint32(start, false) : -1) ? start : null;
}

/**
 * The records FreeType keeps (`ttload.c:444-499`): a record it cannot read ends the directory, one
 * past the file is dropped, and `hmtx` or `vmtx` running past the file is clipped to it.
 */
function validTables(dv: DataView, start: number): Map<string, TableRecord> {
  const tables = new Map<string, TableRecord>();
  const numTables = dv.getUint16(start + 4, false);
  for (let i = 0; i < numTables; i++) {
    const at = start + SFNT_HEADER_LENGTH + i * TABLE_RECORD_LENGTH;
    if (at + TABLE_RECORD_LENGTH > dv.byteLength) break;
    const tag = readTag(dv, at);
    const offset = dv.getUint32(at + 8, false);
    const length = dv.getUint32(at + 12, false);
    if (offset > dv.byteLength) continue;
    const fits = length <= dv.byteLength - offset;
    if (fits) tables.set(tag, { offset, length });
    else if (tag === 'hmtx' || tag === 'vmtx')
      tables.set(tag, { offset, length: (dv.byteLength - offset) & ~3 });
  }
  return tables;
}

/**
 * `check_table_dir` (`ttload.c:175-310`): a `head` or `bhed` shorter than 0x36 bytes fails the font,
 * and it needs one of them, or both `SING` and `META`.
 */
function hasHeadTable(tables: ReadonlyMap<string, TableRecord>): boolean {
  for (const tag of ['head', 'bhed']) {
    const table = tables.get(tag);
    if (table && table.length < HEAD_MIN_LENGTH) return false;
  }
  return tables.has('head') || tables.has('bhed') || (tables.has('SING') && tables.has('META'));
}

/** The fatal steps of `sfnt_load_face` (`sfobjs.c:862-1003`). */
function loadsFace({ dv, tables }: SfntFile, formatTag: number): boolean {
  const hasOutline = tables.has('glyf') || tables.has('CFF ') || tables.has('CFF2');
  const isAppleSbit = !hasOutline && fits(dv, tables.get('bhed'), HEAD_MIN_LENGTH);
  if (!isAppleSbit || tables.has('sbix')) {
    const head = tables.get('head');
    if (!fits(dv, head, HEAD_MIN_LENGTH)) return false;
    const unitsPerEm = dv.getUint16(head!.offset + 18, false);
    if (unitsPerEm < MIN_UNITS_PER_EM || unitsPerEm > MAX_UNITS_PER_EM) return false;
  }
  if (isAppleSbit) return true;
  return loadsHorizontalMetrics(dv, tables, formatTag) && !hasBrokenVerticalHeader(dv, tables);
}

/** `hhea` with its `hmtx`, except that an sfnt Mac font tagged `true` needs neither (`sfobjs.c:937-985`). */
function loadsHorizontalMetrics(
  dv: DataView,
  tables: ReadonlyMap<string, TableRecord>,
  formatTag: number
): boolean {
  const hhea = tables.get('hhea');
  if (!hhea) return formatTag === TAG_TRUE;
  return fits(dv, hhea, METRICS_HEADER_LENGTH) && tables.has('hmtx');
}

/** A `vhea` FreeType cannot read fails the face, where a missing one does not (`sfobjs.c:991-1000`). */
function hasBrokenVerticalHeader(dv: DataView, tables: ReadonlyMap<string, TableRecord>): boolean {
  const vhea = tables.get('vhea');
  return vhea !== undefined && !fits(dv, vhea, METRICS_HEADER_LENGTH);
}

function fits(dv: DataView, table: TableRecord | undefined, minLength: number): boolean {
  return table !== undefined && table.length >= minLength && table.offset + minLength <= dv.byteLength;
}

/**
 * The header each other driver of Godot's FreeType build probes first (`modules/freetype/SCsub`):
 * Type 1 (`t1parse.c`, `check_type1_format`), CID (`cidparse.c`), Type 42 (`t42parse.c`), BDF
 * (`bdflib.c`), PFR (`pfrload.c`), PCF and its compressed forms (`pcfread.c`, `ftgzip.c`,
 * `ftlzw.c`, `ftbzip2.c`), Windows FNT and FON (`winfnt.c`) and bare CFF (`cffload.c`).
 */
function hasOtherDriverHeader(bytes: Uint8Array): boolean {
  const text = String.fromCharCode(...bytes.subarray(0, 64));
  // A PFB file wraps its first segment in a 6-byte header (`t1parse.c`, `read_pfb_tag`).
  const postScript = bytes[0] === 0x80 && bytes[1] === 0x01 ? text.slice(6) : text;
  if (POSTSCRIPT_HEADERS.some((header) => postScript.startsWith(header))) return true;
  if (text.startsWith('STARTFONT') || text.startsWith('PFR0') || text.startsWith('\x01fcp')) return true;
  if (isCompressedStream(bytes) || isWindowsFont(bytes)) return true;
  return isBareCff(bytes);
}

const POSTSCRIPT_HEADERS = [
  '%!PS-AdobeFont',
  '%!FontType1',
  '%!PS-Adobe-3.0 Resource-CIDFont',
  '%!PS-TrueTypeFont',
];

/** gzip, Unix `compress` or bzip2, which the PCF driver opens through its stream filters. */
function isCompressedStream(bytes: Uint8Array): boolean {
  if (bytes[0] === 0x1f && (bytes[1] === 0x8b || bytes[1] === 0x9d)) return true;
  return bytes[0] === 0x42 && bytes[1] === 0x5a && bytes[2] === 0x68;
}

/** An `MZ` executable that holds font resources, or a bare FNT of version 2.0 or 3.0. */
function isWindowsFont(bytes: Uint8Array): boolean {
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) return true;
  return bytes[0] === 0x00 && (bytes[1] === 0x02 || bytes[1] === 0x03);
}

/** A CFF header: major version 1, a header of at least 4 bytes, and an offset size of 1 to 4. */
function isBareCff(bytes: Uint8Array): boolean {
  const [major, , headerSize, offsetSize] = bytes;
  return major === 1 && headerSize! >= 4 && offsetSize! >= 1 && offsetSize! <= 4;
}
