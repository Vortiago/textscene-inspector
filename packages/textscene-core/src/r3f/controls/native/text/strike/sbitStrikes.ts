/**
 * The bitmap strikes of a font as FreeType loads them (`ttsbit.c:48-460`, `sfobjs.c:1255-1320`): the
 * `CBLC` or `EBLC` locator and its `CBDT` or `EBDT` data, or the `sbix` table, and the size and
 * metrics of each strike with a valid ppem.
 *
 * Portions ported from FreeType (FreeType License).
 * Copyright (c) 1996-2024 David Turner, Robert Wilhelm and Werner Lemberg.
 */
import { ftDivFix, ftMulFix } from '../fontMetrics';
import {
  HHEA_ASCENDER_OFFSET,
  HHEA_DESCENDER_OFFSET,
  OS2_TABLE_MIN_LENGTH,
  readHeadUnitsPerEm,
  tableBytes,
  tableFits,
  type SfntFile,
} from '../sfntTables';
import { toInt16, toInt8 } from '../../../../../godot/variant/intWidth';

/** The table a font's strikes come from: `CBLC` for colour, `EBLC` (or Apple's `bloc`) for grey, or `sbix`. */
export type SbitTableKind = 'CBLC' | 'EBLC' | 'sbix';

/** A strike's size metrics in 26.6, and the 16.16 scale of its advances (`FT_Size_Metrics`). */
export interface StrikeMetrics {
  readonly xPpem: number;
  readonly yPpem: number;
  readonly ascender: number;
  readonly descender: number;
  readonly xScale: number;
  readonly yScale: number;
}

/** A strike FreeType lists in `available_sizes`. */
export interface SbitStrike {
  /** The strike's index in its table, which `sbit_strike_map` maps the listed index to. */
  readonly tableIndex: number;
  readonly metrics: StrikeMetrics;
  /** `FT_Bitmap_Size.width`: the average advance at the strike's ppem, which Godot matches the font size to. */
  readonly width: number;
}

export interface SbitTables {
  readonly kind: SbitTableKind;
  /** The `CBLC` or `EBLC` locator, or the `sbix` table. */
  readonly locator: Uint8Array;
  /** The `CBDT` or `EBDT` data, or the `sbix` table again, which holds its own data. */
  readonly data: Uint8Array;
  readonly strikes: readonly SbitStrike[];
}

/** The `EBLC` and `CBLC` header: version(4) numSizes(4). A strike record is 48 bytes. */
const LOCATOR_HEADER_SIZE = 8;
const STRIKE_RECORD_SIZE = 48;
/** `sbix`: version(2) flags(2) numStrikes(4), then a 4-byte offset per strike. */
const SBIX_HEADER_SIZE = 8;
/** `OS/2.xAvgCharWidth`. */
const OS2_AVERAGE_WIDTH_OFFSET = 2;

/**
 * The strikes of `sfnt`, or null for a font with no table FreeType takes, or with no data table: then
 * it has no fixed sizes. FreeType looks for `CBLC`, then `EBLC` and `bloc`, then `sbix`.
 */
export function readSbitTables(sfnt: SfntFile): SbitTables | null {
  const unitsPerEm = readHeadUnitsPerEm(sfnt);
  const located = locatorOf(sfnt);
  if (!located || located.locator.length < LOCATOR_HEADER_SIZE) return null;
  const { kind, locator } = located;
  const data = kind === 'sbix' ? locator : dataTableOf(sfnt);
  const count = kind === 'sbix' ? sbixStrikeCount(locator) : locatorStrikeCount(locator);
  if (count === null || data.length === 0) return null;
  const strikes: SbitStrike[] = [];
  const { averageWidth, emSize } = averageWidthOf(sfnt, unitsPerEm);
  for (let tableIndex = 0; tableIndex < count; tableIndex++) {
    const metrics =
      kind === 'sbix'
        ? sbixStrikeMetrics(sfnt, locator, tableIndex, unitsPerEm)
        : locatorStrikeMetrics(locator, tableIndex, unitsPerEm);
    if (!metrics || metrics.xPpem === 0 || metrics.yPpem === 0) continue;
    const width = Math.trunc((averageWidth * metrics.xPpem + Math.trunc(emSize / 2)) / emSize);
    strikes.push({ tableIndex, metrics, width: toInt16(width) });
  }
  return strikes.length > 0 ? { kind, locator, data, strikes } : null;
}

function locatorOf(sfnt: SfntFile): { kind: SbitTableKind; locator: Uint8Array } | null {
  for (const [tag, kind] of [
    ['CBLC', 'CBLC'],
    ['EBLC', 'EBLC'],
    ['bloc', 'EBLC'],
    ['sbix', 'sbix'],
  ] as const) {
    if (sfnt.tables.has(tag)) return { kind, locator: tableBytes(sfnt, tag) };
  }
  return null;
}

/** The bitmap data: FreeType takes `CBDT`, `EBDT` or `bdat`, the first it finds, whichever locator the font has. */
function dataTableOf(sfnt: SfntFile): Uint8Array {
  const tag = ['CBDT', 'EBDT', 'bdat'].find((name) => sfnt.tables.has(name));
  return tag ? tableBytes(sfnt, tag) : new Uint8Array(0);
}

/** The strikes of a locator whose records fit, or null for a version FreeType does not know (`ttsbit.c:104-121`). */
function locatorStrikeCount(locator: Uint8Array): number | null {
  const view = viewOf(locator);
  const version = view.getUint32(0);
  const count = view.getUint32(4);
  const isKnown =
    (version & 0xffff0000) >>> 0 === 0x00020000 ||
    (version & 0x0000ffff) === 0x00000200 ||
    (version & 0xffff0000) >>> 0 === 0x00030000 ||
    (version & 0x0000ffff) === 0x00000300;
  if (!isKnown || count >= 0x10000) return null;
  return Math.min(count, Math.floor((locator.length - LOCATOR_HEADER_SIZE) / STRIKE_RECORD_SIZE));
}

/** The strikes of an `sbix` table whose offsets fit, or null for a version or flags FreeType refuses (`ttsbit.c:150-183`). */
function sbixStrikeCount(sbix: Uint8Array): number | null {
  const view = viewOf(sbix);
  const version = view.getUint16(0);
  const flags = view.getUint16(2);
  const count = view.getUint32(4);
  if (version < 1 || !(flags === 1 || flags === 3) || count >= 0x10000) return null;
  return Math.min(count, Math.floor((sbix.length - SBIX_HEADER_SIZE) / 4));
}

/**
 * `tt_face_load_strike_metrics` of a `CBLC` or `EBLC` strike (`ttsbit.c:302-381`): its ppem, and its
 * ascender and descender, mended where the table holds a sign the wrong way or no height at all.
 */
function locatorStrikeMetrics(locator: Uint8Array, tableIndex: number, unitsPerEm: number): StrikeMetrics {
  const strike = locator.subarray(LOCATOR_HEADER_SIZE + tableIndex * STRIKE_RECORD_SIZE);
  const xPpem = strike[44]!;
  const yPpem = strike[45]!;
  let ascender = toInt8(strike[16]!) * 64;
  let descender = toInt8(strike[17]!) * 64;
  const maxBeforeBaseline = toInt8(strike[24]!);
  const minAfterBaseline = toInt8(strike[25]!);
  if (descender > 0) {
    if (minAfterBaseline < 0) descender = -descender;
  } else if (descender === 0 && ascender === 0) {
    if (maxBeforeBaseline || minAfterBaseline) {
      ascender = maxBeforeBaseline * 64;
      descender = minAfterBaseline * 64;
    } else {
      ascender = yPpem * 64;
    }
  }
  if (ascender - descender === 0) descender = ascender - yPpem * 64;
  return {
    xPpem,
    yPpem,
    ascender,
    descender,
    xScale: ftDivFix(xPpem * 64, unitsPerEm),
    yScale: ftDivFix(yPpem * 64, unitsPerEm),
  };
}

/**
 * `tt_face_load_strike_metrics` of an `sbix` strike (`ttsbit.c:384-425`): the ppem its header gives,
 * and `hhea`'s ascender and descender at that ppem. Null for a strike past the table.
 */
function sbixStrikeMetrics(
  sfnt: SfntFile,
  sbix: Uint8Array,
  tableIndex: number,
  unitsPerEm: number
): StrikeMetrics | null {
  const view = viewOf(sbix);
  const offset = view.getUint32(SBIX_HEADER_SIZE + 4 * tableIndex);
  if (offset + 4 > sbix.length) return null;
  const ppem = view.getUint16(offset);
  const scale = ftDivFix(ppem * 64, unitsPerEm);
  const { ascender, descender } = horizontalHeaderOf(sfnt);
  return {
    xPpem: ppem,
    yPpem: ppem,
    ascender: ftMulFix(ascender, scale),
    descender: ftMulFix(descender, scale),
    xScale: scale,
    yScale: scale,
  };
}

/** `hhea`'s own ascender and descender, which FreeType keeps apart from the face's. */
function horizontalHeaderOf({ dv, tables }: SfntFile): { ascender: number; descender: number } {
  const hhea = tables.get('hhea');
  if (!hhea || !tableFits(dv, hhea, HHEA_DESCENDER_OFFSET + 2)) return { ascender: 0, descender: 0 };
  return {
    ascender: dv.getInt16(hhea.offset + HHEA_ASCENDER_OFFSET),
    descender: dv.getInt16(hhea.offset + HHEA_DESCENDER_OFFSET),
  };
}

/**
 * `OS/2.xAvgCharWidth` and the em it divides by, or 1 and 1 for a font with no `OS/2` or no em, so
 * a strike's width is its ppem (`sfobjs.c:1268-1272`).
 */
function averageWidthOf(
  { dv, tables }: SfntFile,
  unitsPerEm: number
): { averageWidth: number; emSize: number } {
  const os2 = tables.get('OS/2');
  if (unitsPerEm === 0 || !os2 || !tableFits(dv, os2, OS2_TABLE_MIN_LENGTH))
    return { averageWidth: 1, emSize: 1 };
  return { averageWidth: dv.getInt16(os2.offset + OS2_AVERAGE_WIDTH_OFFSET), emSize: unitsPerEm };
}

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
