/**
 * Reads a scene font's table directory, its `head.unitsPerEm`, its ascender and descender, and the
 * default of each `fvar` axis: the facts the runtime bundle cannot get from `fontkit`, a
 * bake-time-only devDependency that `pnpm check:bundle-size` keeps out. Advances and kerning come from
 * canvas `measureText`, and the glyph outlines from `sfntOutlines.ts`, which opens the font through
 * this module. `fontContainer.ts` opens a WOFF or WOFF2 into the same `SfntFile`.
 */

import { perObject } from '../../../../utils/perObject';

/** `head.unitsPerEm` and the magnitudes of `hhea.ascender` and `hhea.descender`, in design units. */
export interface SfntScalars {
  readonly unitsPerEm: number;
  readonly ascent: number;
  readonly descent: number;
}

/**
 * The sfnt version tags of the OpenType spec, "OpenType Font File" §"sfntVersion". Only plain SFNT
 * reads here: TrueType (0x00010000 or `'true'`), OpenType-CFF (`'OTTO'`) and the first face of a
 * `'ttcf'` collection. A WOFF or WOFF2 compresses its tables, so `fontContainer.ts` decompresses them first.
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
// OS/2 table: fsSelection at 62, sTypoAscender(2) sTypoDescender(2) sTypoLineGap(2) usWinAscent(2) usWinDescent(2) from 68.
const OS2_FS_SELECTION_OFFSET = 62;
const OS2_TYPO_ASCENDER_OFFSET = 68;
const OS2_TYPO_DESCENDER_OFFSET = 70;
const OS2_WIN_ASCENT_OFFSET = 74;
const OS2_WIN_DESCENT_OFFSET = 76;
const OS2_TABLE_MIN_LENGTH = 78;
const OS2_USE_TYPO_METRICS = 1 << 7; // fsSelection bit 7
// fvar table: majorVersion(2) minorVersion(2) axesArrayOffset(2) reserved(2) axisCount(2) axisSize(2) ...
const FVAR_AXES_ARRAY_OFFSET_FIELD = 4;
const FVAR_AXIS_COUNT_FIELD = 8;
const FVAR_HEADER_SIZE = 16;
// VariationAxisRecord: axisTag(4) minValue(4) defaultValue(4) maxValue(4) flags(2) axisNameID(2)
const FVAR_AXIS_SIZE = 20;
const FVAR_AXIS_DEFAULT_OFFSET = 8;
const FIXED_UNITS = 65536; // Fixed is 16.16

/** The tables the readers of this module use. A compressed container decompresses these and no others. */
export const SCENE_FONT_TABLE_TAGS: readonly string[] = ['head', 'hhea', 'OS/2', 'fvar'];

export interface TableRecord {
  offset: number;
  length: number;
}

/** A plain SFNT container: its bytes and its tables by tag. */
export interface SfntFile {
  readonly dv: DataView;
  readonly tables: ReadonlyMap<string, TableRecord>;
}

/** The tables `tables` names, laid end to end in one buffer, as an `SfntFile` of a font that holds only them. */
export function sfntFileOfTables(tables: ReadonlyMap<string, Uint8Array>): SfntFile {
  const buffer = new ArrayBuffer([...tables.values()].reduce((sum, data) => sum + data.length, 0));
  const records = new Map<string, TableRecord>();
  let offset = 0;
  for (const [tag, data] of tables) {
    new Uint8Array(buffer, offset, data.length).set(data);
    records.set(tag, { offset, length: data.length });
    offset += data.length;
  }
  return { dv: new DataView(buffer), tables: records };
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
export function tableFits(dv: DataView, table: TableRecord, minLength: number): boolean {
  return table.offset + minLength <= dv.byteLength && table.length >= minLength;
}

/**
 * Opens raw SFNT bytes: a plain container (TrueType, OpenType-CFF, or the first face of a `'ttcf'`
 * collection) with a table directory that fits. Returns `null`, never throws, for a compressed
 * container, an unknown `sfntVersion` or a directory past the buffer. A font file opens once,
 * whether its scalars or its outlines ask first.
 */
export const openSfnt = perObject(readSfnt);

function readSfnt(bytes: ArrayBuffer): SfntFile | null {
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
  return tables && { dv, tables };
}

/** `head.unitsPerEm`; the caller has checked that `head` fits. */
export function readUnitsPerEm(dv: DataView, head: TableRecord): number {
  return dv.getUint16(head.offset + HEAD_UNITS_PER_EM_OFFSET, false);
}

/** The signed ascender and descender, in design units, that FreeType gives the face. */
interface VerticalMetrics {
  readonly ascender: number;
  readonly descender: number;
}

/**
 * The vertical metrics Godot reads from FreeType's size metrics (`text_server_adv.cpp:1515-1516`),
 * which FreeType takes from `OS/2` typographic metrics when the font sets USE_TYPO_METRICS, else
 * from `hhea`, else from the typographic and then the Windows metrics when `hhea` holds zero
 * (`thirdparty/freetype/src/sfnt/sfobjs.c:1380-1413`). An `OS/2` table too short to hold them is absent.
 */
function readVerticalMetrics(dv: DataView, hhea: TableRecord, os2: TableRecord | undefined): VerticalMetrics {
  const hasOs2 = os2 !== undefined && tableFits(dv, os2, OS2_TABLE_MIN_LENGTH);
  const typo = hasOs2 && {
    ascender: dv.getInt16(os2.offset + OS2_TYPO_ASCENDER_OFFSET, false),
    descender: dv.getInt16(os2.offset + OS2_TYPO_DESCENDER_OFFSET, false),
  };
  if (typo && dv.getUint16(os2.offset + OS2_FS_SELECTION_OFFSET, false) & OS2_USE_TYPO_METRICS) return typo;

  const horizontal = {
    ascender: dv.getInt16(hhea.offset + HHEA_ASCENDER_OFFSET, false),
    descender: dv.getInt16(hhea.offset + HHEA_DESCENDER_OFFSET, false),
  };
  if (horizontal.ascender !== 0 || horizontal.descender !== 0 || !typo) return horizontal;
  if (typo.ascender !== 0 || typo.descender !== 0) return typo;
  return {
    ascender: dv.getUint16(os2.offset + OS2_WIN_ASCENT_OFFSET, false),
    descender: -dv.getUint16(os2.offset + OS2_WIN_DESCENT_OFFSET, false),
  };
}

/**
 * Reads the scalars from the tables of an opened font. Returns `null`, never throws, for a missing
 * `head` or `hhea`, or an offset past the buffer, so a broken font falls back to the bundled default.
 */
export function parseSfntScalars({ dv, tables }: SfntFile): SfntScalars | null {
  const head = tables.get('head');
  const hhea = tables.get('hhea');
  if (!head || !hhea) return null;
  if (!tableFits(dv, head, HEAD_TABLE_MIN_LENGTH) || !tableFits(dv, hhea, HHEA_TABLE_MIN_LENGTH)) return null;

  const unitsPerEm = readUnitsPerEm(dv, head);
  if (unitsPerEm === 0) return null; // degenerate; every downstream scale divides by this

  const { ascender, descender } = readVerticalMetrics(dv, hhea, tables.get('OS/2'));
  return { unitsPerEm, ascent: Math.abs(ascender), descent: Math.abs(descender) };
}

/**
 * The default value of each `fvar` axis by its tag, as Godot resets every axis to before it applies
 * a variation (`text_server_adv.cpp:1930-1933`). Empty for a font with no `fvar`, or one whose
 * axis records do not fit the table.
 */
export function readAxisDefaults({ dv, tables }: SfntFile): Readonly<Record<string, number>> {
  const fvar = tables.get('fvar');
  const defaults: Record<string, number> = {};
  if (!fvar || !tableFits(dv, fvar, FVAR_HEADER_SIZE)) return defaults;

  const axesStart = fvar.offset + dv.getUint16(fvar.offset + FVAR_AXES_ARRAY_OFFSET_FIELD, false);
  const axisCount = dv.getUint16(fvar.offset + FVAR_AXIS_COUNT_FIELD, false);
  if (axesStart + axisCount * FVAR_AXIS_SIZE > fvar.offset + fvar.length) return defaults;

  for (let axis = 0; axis < axisCount; axis++) {
    const at = axesStart + axis * FVAR_AXIS_SIZE;
    const tag = String.fromCharCode(
      dv.getUint8(at),
      dv.getUint8(at + 1),
      dv.getUint8(at + 2),
      dv.getUint8(at + 3)
    );
    defaults[tag] = dv.getInt32(at + FVAR_AXIS_DEFAULT_OFFSET, false) / FIXED_UNITS;
  }
  return defaults;
}
