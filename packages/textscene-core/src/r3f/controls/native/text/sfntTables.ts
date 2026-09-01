/**
 * A minimal, pure, DOM-free reader of the ONE thing a scene-authored font
 * needs from its own SFNT tables: `head`'s `unitsPerEm` and `hhea`'s
 * `ascender`/`descender` — the raw design-unit scalars `FontMetrics`
 * (`./fontMetrics.ts`) requires and this repo's build-time `fontkit`
 * dependency is not allowed to travel into the runtime bundle to provide
 * (`bake-metrics.mjs`'s own header: `fontkit` is a bake-time-only
 * devDependency, gated by `pnpm check:bundle-size`).
 *
 * Deliberately narrow: this is NOT a general SFNT/OpenType parser. It reads
 * exactly the table directory plus two fixed-layout tables and nothing else
 * (no glyph outlines, no `cmap`, no `OS/2`) — every other per-character
 * quantity (advances, kerning, the font's own "average glyph width") comes
 * from the browser's real font-shaping engine via canvas `measureText`
 * against a registered `FontFace`, never a hand-rolled read of `hmtx`/`kern`/
 * `GPOS` (`runtimeFontMetrics.ts`'s own doc has why).
 *
 * ## Format coverage
 *
 * Plain SFNT — TrueType-outline (`sfntVersion` 0x00010000 or `'true'`),
 * OpenType-CFF (`'OTTO'`), and a TrueType Collection's FIRST face (`'ttcf'`,
 * per the `ttc_header` "font 0" offset). That covers every `.ttf`/`.otf`;
 * `.woff2` is not read here.
 * WOFF2's table data is Brotli-compressed (`wOF2` container), and neither
 * `DecompressionStream` (no browser exposes a `'brotli'` format) nor a
 * bundled decompressor (the CSP blocks WASM entirely — no `unsafe-eval`) can
 * read it in this webview. `parseSfntScalars` returns `null` for a `.woff2`
 * (and any other signature it does not recognise, including a genuinely
 * malformed/truncated file); the caller's documented fallback is canvas
 * `TextMetrics.fontBoundingBoxAscent`/`.fontBoundingBoxDescent` against the
 * SAME registered `FontFace` — see `runtimeFontMetrics.ts`'s own doc for the
 * measured error that substitution carries.
 *
 * Every read is bounds-checked against the buffer's own length; a truncated
 * or corrupt file returns `null` rather than throwing — a broken font must
 * fall back to the bundled default (`fontMetrics.ts`'s contract), never crash
 * the render.
 */

/** `head.unitsPerEm`, `hhea.ascender` (magnitude, upward-positive), `hhea.descender` (magnitude, downward-positive) — all design units, all as this font's own tables declare them. */
export interface SfntScalars {
  readonly unitsPerEm: number;
  readonly ascent: number;
  readonly descent: number;
}

/** TrueType-outline, OpenType-CFF, legacy Mac TrueType, and (unsupported here) PostScript Type 1 sfnt version tags — `OpenType spec, "OpenType Font File" §"sfntVersion"`. */
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

/** `'ttcf'` — TrueType Collection header tag (OpenType spec, "TrueType Collection Font File"). */
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

/** Reads the table directory starting at `sfntTableDirectoryStart` (immediately after the 12-byte sfnt header at that offset), returning `null` if the directory itself doesn't fit in `dv`. */
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

/** `table.offset + minLength` must fit inside `dv` — guards every subsequent fixed-offset field read in that table. */
function tableFits(dv: DataView, table: TableRecord, minLength: number): boolean {
  return table.offset + minLength <= dv.byteLength && table.length >= minLength;
}

/**
 * Reads `head.unitsPerEm` and `hhea.ascender`/`.descender` from raw SFNT
 * bytes. Returns `null` for anything this reader does not recognise or
 * cannot safely read in full: a compressed container (`wOFF`/`wOF2`), an
 * unrecognised `sfntVersion`, a missing `head`/`hhea` table, or any offset
 * the table directory claims that overruns the buffer (a truncated/corrupt
 * file). Never throws.
 */
export function parseSfntScalars(bytes: ArrayBuffer): SfntScalars | null {
  if (bytes.byteLength < 4) return null;
  const dv = new DataView(bytes);

  let sfntStart = 0;
  const firstTag = dv.getUint32(0, false);
  if (firstTag === SFNT_VERSION_TTC) {
    // ttc_header: ttcTag(4) majorVersion(2) minorVersion(2) numFonts(4) then
    // numFonts * OffsetTable(4) — the FIRST face's own sfnt offset table
    // start is the first entry.
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
