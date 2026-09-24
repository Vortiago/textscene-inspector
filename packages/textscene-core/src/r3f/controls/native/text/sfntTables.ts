/**
 * Reads `head.unitsPerEm` and `hhea` ascender and descender from a scene font, the scalars the
 * runtime bundle cannot get from `fontkit`, a bake-time-only devDependency that `pnpm check:bundle-size`
 * keeps out. It reads the table directory and those two tables only: advances and kerning come
 * from canvas `measureText`.
 */

/** `head.unitsPerEm` and the magnitudes of `hhea.ascender` and `hhea.descender`, in design units. */
export interface SfntScalars {
  readonly unitsPerEm: number;
  readonly ascent: number;
  readonly descent: number;
}

/**
 * The sfnt version tags of the OpenType spec, "OpenType Font File" §"sfntVersion". Only plain SFNT reads: TrueType
 * (0x00010000 or `'true'`), OpenType-CFF (`'OTTO'`) and the first face of a `'ttcf'` collection. WOFF2 tables are
 * Brotli-compressed, and the webview can decompress neither with `DecompressionStream`, which has no `'brotli'`
 * format, nor with WASM, which the CSP blocks.
 */
const SFNT_VERSION_TRUETYPE = 0x00010000;
const SFNT_VERSION_OTTO = 0x4f54544f; // 'OTTO'
const SFNT_VERSION_TRUE = 0x74727565; // 'true' (legacy Mac TrueType)
const SFNT_VERSION_TYPE1 = 0x74797031; // 'typ1' (rare; table layout below still applies)
const VALID_SFNT_VERSIONS: ReadonlySet<number> = new Set([
  SFNT_VERSION_TRUETYPE,
  SFNT_VERSION_OTTO,
  SFNT_VERSION_TRUE,
  SFNT_VERSION_TYPE1,
]);

/** `'ttcf'`, the TrueType Collection header tag (OpenType spec, "TrueType Collection Font File"). */
const SFNT_VERSION_TTC = 0x74746366;

const SFNT_HEADER_SIZE = 12; // sfntVersion(4) numTables(2) searchRange(2) entrySelector(2) rangeShift(2)
const TABLE_RECORD_SIZE = 16; // tag(4) checksum(4) offset(4) length(4)
const HEAD_UNITS_PER_EM_OFFSET = 18; // head table: majorVersion(2) minorVersion(2) fontRevision(4) checkSumAdjustment(4) magicNumber(4) flags(2) unitsPerEm(2)
const HEAD_TABLE_MIN_LENGTH = 20;
const HHEA_ASCENDER_OFFSET = 4; // hhea table: majorVersion(2) minorVersion(2) ascender(2) ...
const HHEA_DESCENDER_OFFSET = 6;
const HHEA_TABLE_MIN_LENGTH = 8;

interface TableRecord {
  offset: number;
  length: number;
}

/** Reads the table directory after the 12-byte sfnt header at `sfntStart`, or `null` if it does not fit in `dv`. */
function readTableDirectory(dv: DataView, sfntStart: number): Map<string, TableRecord> | null {
  if (sfntStart + SFNT_HEADER_SIZE > dv.byteLength) return null;
  const numTables = dv.getUint16(sfntStart + 4, false);
  const dirStart = sfntStart + SFNT_HEADER_SIZE;
  const dirEnd = dirStart + numTables * TABLE_RECORD_SIZE;
  if (dirEnd > dv.byteLength) return null;

  const tables = new Map<string, TableRecord>();
  for (let i = 0; i < numTables; i++) {
    const recordStart = dirStart + i * TABLE_RECORD_SIZE;
    const tag = String.fromCharCode(
      dv.getUint8(recordStart),
      dv.getUint8(recordStart + 1),
      dv.getUint8(recordStart + 2),
      dv.getUint8(recordStart + 3)
    );
    tables.set(tag, {
      offset: dv.getUint32(recordStart + 8, false),
      length: dv.getUint32(recordStart + 12, false),
    });
  }
  return tables;
}

/** Guards each fixed-offset field read in `table`: `table.offset + minLength` must fit inside `dv`. */
function tableFits(dv: DataView, table: TableRecord, minLength: number): boolean {
  return table.offset + minLength <= dv.byteLength && table.length >= minLength;
}

/**
 * Reads the scalars from raw SFNT bytes. Returns `null`, never throws, for a compressed container,
 * an unknown `sfntVersion`, a missing `head` or `hhea`, or an offset past the buffer, so a broken
 * font falls back to the bundled default.
 */
export function parseSfntScalars(bytes: ArrayBuffer): SfntScalars | null {
  if (bytes.byteLength < 4) return null;
  const dv = new DataView(bytes);

  let sfntStart = 0;
  const firstTag = dv.getUint32(0, false);
  if (firstTag === SFNT_VERSION_TTC) {
    // ttc_header: ttcTag(4) majorVersion(2) minorVersion(2) numFonts(4), then one offset per face.
    // The first entry is the first face's offset table.
    const TTC_FIRST_OFFSET_FIELD = 12;
    if (TTC_FIRST_OFFSET_FIELD + 4 > dv.byteLength) return null;
    sfntStart = dv.getUint32(TTC_FIRST_OFFSET_FIELD, false);
    if (sfntStart + 4 > dv.byteLength) return null;
  }

  const sfntVersion = dv.getUint32(sfntStart, false);
  if (!VALID_SFNT_VERSIONS.has(sfntVersion)) return null;

  const tables = readTableDirectory(dv, sfntStart);
  if (!tables) return null;

  const head = tables.get('head');
  const hhea = tables.get('hhea');
  if (!head || !hhea) return null;
  if (!tableFits(dv, head, HEAD_TABLE_MIN_LENGTH) || !tableFits(dv, hhea, HHEA_TABLE_MIN_LENGTH)) return null;

  const unitsPerEm = dv.getUint16(head.offset + HEAD_UNITS_PER_EM_OFFSET, false);
  const ascender = dv.getInt16(hhea.offset + HHEA_ASCENDER_OFFSET, false);
  const descender = dv.getInt16(hhea.offset + HHEA_DESCENDER_OFFSET, false);
  if (unitsPerEm === 0) return null; // degenerate; every downstream scale divides by this

  return { unitsPerEm, ascent: Math.abs(ascender), descent: Math.abs(descender) };
}
