/**
 * Opens the `CFF ` or `CFF2` table of an OpenType font: the INDEX structures, the DICT entries
 * that locate the charstrings and their subroutines, the font dict each glyph belongs to, and, for
 * `seac`, the charset. Adobe Technical Notes 5176 (CFF) and 5177 (Type 2 charstrings) and the
 * OpenType `CFF2` table define the layout. `cffCharstring.ts` runs the charstrings it finds.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { resolveFontMatrices, type FontMatrix } from './cffFontMatrix';
import { readFontMatrix } from './cffFontMatrixOperands';
import { readRealValue, realEnd } from './cffReal';
import { privateBluesOf, type PrivateBlues } from './cffPrivateDict';
import {
  EXPERT_CHARSET,
  EXPERT_SUBSET_CHARSET,
  ISO_ADOBE_CHARSET,
  standardEncodingSid,
} from './cffPredefined';
import { readHeadUnitsPerEm, type SfntFile, type TableRecord } from './sfntTables';

/** The entries of an INDEX, as absolute byte ranges in the table's buffer. */
interface CffIndex {
  readonly count: number;
  /** The byte range of entry `i`, or null past the last entry. */
  entry(i: number): { start: number; end: number } | null;
  /** The byte range of subroutine `number`, which a call names minus the INDEX's bias, or null when there is none. */
  subroutine(number: number): { start: number; end: number } | null;
}

/** What a glyph's font dict gives its charstring. */
export interface CffPrivate {
  readonly localSubrs: CffIndex;
  /** `vsindex` of the Private DICT, the variation data a `blend` reads when the glyph names none. CFF2 only. */
  readonly vsindex: number;
  /** The Private DICT's alignment zones, which hint a glyph's y. */
  readonly blues: PrivateBlues;
}

/** What a font dict gives the glyphs it holds. */
export interface CffFontDict {
  readonly private: CffPrivate;
  readonly matrix: FontMatrix;
}

export interface CffFont {
  readonly dv: DataView;
  readonly isCff2: boolean;
  readonly charStrings: CffIndex;
  readonly globalSubrs: CffIndex;
  /** The units per em of the Top DICT, the ones the matrix of a font dict is relative to. */
  readonly unitsPerEm: number;
  /**
   * What the font dict that holds `glyphIndex` gives it, or the Top DICT for a font with no font
   * dicts. Null when the `FDSelect` names a font dict the font lacks: FreeType refuses that glyph
   * (`cff_decoder_prepare`, cffdecode.c:2373-2378).
   */
  fontDictOf(glyphIndex: number): CffFontDict | null;
  /** The glyph the charset gives a StandardEncoding code, or null. CFF1 only: `seac` names its parts by standard character. */
  glyphOfStandardCode(code: number): number | null;
  /** The regions an ItemVariationData blends over, or null for a `vsindex` the store lacks. CFF2 only. */
  regionCount(vsindex: number): number | null;
}

const CFF1_HEADER_MIN_LENGTH = 4;
const CFF2_HEADER_LENGTH = 5;

/** DICT operators (Technical Note 5176 Table 9, 5177 `CFF2` Top DICT): a two-byte `12 n` is `1200 + n`. */
const OP_CHARSET = 15;
const OP_CHARSTRINGS = 17;
const OP_PRIVATE = 18;
const OP_SUBRS = 19;
const OP_VSINDEX = 22;
const OP_BLEND = 23;
const OP_VARSTORE = 24;
const OP_FONT_MATRIX = 1207;
const OP_ROS = 1230;
const OP_FDARRAY = 1236;
const OP_FDSELECT = 1237;

/** Operators run to 26, since the CFF2 Top and Private DICTs add `vsindex`, `blend`, `vstore` and `maxstack` above CFF's 21. */
const LAST_OPERATOR = 26;

export type Dict = ReadonlyMap<number, readonly number[]>;

/** A DICT's operands, and its `FontMatrix`, which needs the digits of its reals and so is not read from the operands. */
interface ParsedDict {
  readonly operands: Dict;
  readonly fontMatrix: FontMatrix | undefined;
}

class CffReader {
  constructor(
    readonly dv: DataView,
    readonly isCff2: boolean
  ) {}

  /** The INDEX that starts at `at`, or throws a `RangeError` when its offsets leave the buffer. */
  index(at: number): CffIndex & { end: number } {
    const count = this.isCff2 ? this.dv.getUint32(at, false) : this.dv.getUint16(at, false);
    const countSize = this.isCff2 ? 4 : 2;
    if (count === 0) return { ...EMPTY_INDEX, end: at + countSize };
    const offSize = this.dv.getUint8(at + countSize);
    const offsets = at + countSize + 1;
    const dataStart = offsets + (count + 1) * offSize - 1;
    const offsetAt = (i: number) => this.readOffset(offsets + i * offSize, offSize);
    const end = dataStart + offsetAt(count);
    if (end > this.dv.byteLength) throw new RangeError(`CFF INDEX at ${at} ends at ${end}, past the table`);
    const entry: CffIndex['entry'] = (i) =>
      i >= 0 && i < count ? { start: dataStart + offsetAt(i), end: dataStart + offsetAt(i + 1) } : null;
    return { count, entry, subroutine: (number) => entry(number + subrBias(count)), end };
  }

  private readOffset(at: number, size: number): number {
    let value = 0;
    for (let i = 0; i < size; i++) value = value * 256 + this.dv.getUint8(at + i);
    return value;
  }

  /** The DICT in bytes `[start, end)`: each operator with the operands before it. */
  dict(start: number, end: number): ParsedDict {
    const entries = new Map<number, readonly number[]>();
    let fontMatrix: FontMatrix | undefined;
    let operands: number[] = [];
    // Where each operand starts, kept for the FontMatrix: the operands before a `blend` are the first it leaves.
    let operandStarts: number[] = [];
    let at = start;
    let operandAt: number;
    const take = (operand: number) => {
      operands.push(operand);
      operandStarts.push(operandAt);
    };
    while (at < end) {
      operandAt = at;
      const b0 = this.dv.getUint8(at++);
      if (b0 === OP_BLEND && this.isCff2) {
        operands = defaultInstance(operands);
        operandStarts.length = operands.length;
      } else if (b0 <= LAST_OPERATOR) {
        const operator = b0 === 12 ? 1200 + this.dv.getUint8(at++) : b0;
        if (operator === OP_FONT_MATRIX) {
          fontMatrix = readFontMatrix(this.dv, operands, operandStarts, end) ?? undefined;
          // FreeType fails the DICT, and with it the font (`cff_parse_font_matrix` returns Stack_Underflow).
          if (!fontMatrix) throw new RangeError(`FontMatrix needs 6 operands, got ${operands.length}`);
        } else {
          entries.set(operator, operands);
        }
        operands = [];
        operandStarts = [];
      } else if (b0 === 28) {
        take(this.dv.getInt16(at, false));
        at += 2;
      } else if (b0 === 29) {
        take(this.dv.getInt32(at, false));
        at += 4;
      } else if (b0 === 30) {
        take(readRealValue(this.dv, at - 1, end));
        at = realEnd(this.dv, at - 1);
      } else if (b0 >= 32 && b0 <= 246) {
        take(b0 - 139);
      } else if (b0 >= 247 && b0 <= 254) {
        take(twoByteInteger(b0, this.dv.getUint8(at++)));
      }
    }
    return { operands: entries, fontMatrix };
  }
}

/**
 * The operands a `blend` in a CFF2 DICT leaves at the default instance: its last operand counts
 * the values, which are the first operands, and the deltas that follow them go (`cff_parse_blend`
 * with every region at weight 0).
 */
function defaultInstance(operands: number[]): number[] {
  const count = operands.pop() ?? 0;
  return count >= 0 && count <= operands.length ? operands.slice(0, count) : [];
}

function first(dict: Dict, operator: number): number | undefined {
  return dict.get(operator)?.[0];
}

/** The integer of a number whose first byte is 247 to 254: 247 to 250 are positive, 251 to 254 negative (Technical Note 5176 Table 3). */
export function twoByteInteger(first: number, second: number): number {
  return first <= 250 ? (first - 247) * 256 + second + 108 : -((first - 251) * 256 + second) - 108;
}

/** The standard charstring bias for a subroutine INDEX (Technical Note 5177 §4.7). */
function subrBias(count: number): number {
  if (count < 1240) return 107;
  return count < 33900 ? 1131 : 32768;
}

const EMPTY_INDEX: CffIndex = { count: 0, entry: () => null, subroutine: () => null };

/** The glyph to font dict map of an `FDSelect` (Technical Note 5176 §19, 5177 for format 4). */
function fdSelector(dv: DataView, at: number, glyphCount: number): (glyphIndex: number) => number {
  const format = dv.getUint8(at);
  if (format === 0) return (glyphIndex) => dv.getUint8(at + 1 + glyphIndex);
  const isLong = format === 4;
  const rangeCount = isLong ? dv.getUint32(at + 1, false) : dv.getUint16(at + 1, false);
  const rangeSize = isLong ? 6 : 3;
  const ranges = at + (isLong ? 5 : 3);
  const firstOf = isLong
    ? (i: number) => dv.getUint32(ranges + i * rangeSize, false)
    : (i: number) => dv.getUint16(ranges + i * rangeSize, false);
  const fdOf = isLong
    ? (i: number) => dv.getUint16(ranges + i * rangeSize + 4, false)
    : (i: number) => dv.getUint8(ranges + i * rangeSize + 2);
  return (glyphIndex) => {
    if (glyphIndex >= glyphCount) return 0;
    let low = 0;
    let high = rangeCount - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (firstOf(middle) <= glyphIndex) low = middle;
      else high = middle - 1;
    }
    return fdOf(low);
  };
}

/**
 * The string id of each glyph, from the charset operand of the Top DICT (Technical Note 5176 §13):
 * 0 to 2 name a predefined charset, else it is the offset of a format 0, 1 or 2 table. Null when a
 * predefined charset has fewer glyphs than the font, or a table has another format: FreeType refuses both.
 */
function charsetSids(
  dv: DataView,
  base: number,
  charset: number,
  glyphCount: number
): readonly number[] | null {
  const predefined = [ISO_ADOBE_CHARSET, EXPERT_CHARSET, EXPERT_SUBSET_CHARSET][charset];
  if (predefined) return glyphCount <= predefined.length ? predefined.slice(0, glyphCount) : null;
  const format = dv.getUint8(base + charset);
  if (format > 2) return null;
  const start = base + charset + 1;
  return format === 0 ? listedSids(dv, start, glyphCount) : rangedSids(dv, start, glyphCount, format === 2);
}

/** Charset format 0: one string id for each glyph after `.notdef`. */
function listedSids(dv: DataView, start: number, glyphCount: number): number[] {
  return [
    0,
    ...Array.from({ length: Math.max(0, glyphCount - 1) }, (_, i) => dv.getUint16(start + i * 2, false)),
  ];
}

/** Charset formats 1 and 2: ranges of consecutive string ids, each with a one-byte or, in format 2, two-byte count. */
function rangedSids(dv: DataView, start: number, glyphCount: number, hasLongCount: boolean): number[] {
  const sids = [0];
  for (let cursor = start; sids.length < glyphCount; cursor += hasLongCount ? 4 : 3) {
    const firstSid = dv.getUint16(cursor, false);
    const left = hasLongCount ? dv.getUint16(cursor + 2, false) : dv.getUint8(cursor + 2);
    for (let i = 0; i <= left && sids.length < glyphCount; i++) sids.push(firstSid + i);
  }
  return sids;
}

/**
 * ItemVariationData's `regionIndexCount` for each data subtable of a `VarStore` (OpenType "Item
 * variation store"), null for one that names a region the store's region list lacks, which makes
 * FreeType refuse a `blend` that uses it.
 */
function regionCounts(dv: DataView, store: number): readonly (number | null)[] {
  const regionListCount = dv.getUint16(store + dv.getUint32(store + 2, false) + 2, false);
  const dataCount = dv.getUint16(store + 6, false);
  return Array.from({ length: dataCount }, (_, i) => {
    const data = store + dv.getUint32(store + 8 + i * 4, false);
    const count = dv.getUint16(data + 4, false);
    const regionIndices = Array.from({ length: count }, (_, j) => dv.getUint16(data + 6 + j * 2, false));
    return regionIndices.every((region) => region < regionListCount) ? count : null;
  });
}

function fontDictsOf(reader: CffReader, at: number): ParsedDict[] {
  const index = reader.index(at);
  return Array.from({ length: index.count }, (_, i) => {
    const { start, end } = index.entry(i)!;
    return reader.dict(start, end);
  });
}

function privateOf(reader: CffReader, base: number, font: ParsedDict, isCff2: boolean): CffPrivate {
  const [size, offset] = font.operands.get(OP_PRIVATE) ?? [0, 0];
  if (!size || offset === undefined)
    return { localSubrs: EMPTY_INDEX, vsindex: 0, blues: privateBluesOf(new Map()) };
  const start = base + offset;
  const priv = reader.dict(start, start + size).operands;
  const subrs = first(priv, OP_SUBRS);
  return {
    localSubrs: subrs === undefined ? EMPTY_INDEX : reader.index(start + subrs),
    vsindex: isCff2 ? (first(priv, OP_VSINDEX) ?? 0) : 0,
    blues: privateBluesOf(priv),
  };
}

/** The Top DICT, and where the global subroutine INDEX that follows it starts, or null for a CFF with no Top DICT. */
function topDictOf(reader: CffReader, base: number): { topDict: ParsedDict; globalSubrsAt: number } | null {
  const { dv, isCff2 } = reader;
  if (isCff2) {
    const headerSize = dv.getUint8(base + 2);
    const topLength = dv.getUint16(base + 3, false);
    return {
      topDict: reader.dict(base + headerSize, base + headerSize + topLength),
      globalSubrsAt: base + headerSize + topLength,
    };
  }
  const names = reader.index(base + dv.getUint8(base + 2));
  const tops = reader.index(names.end);
  const top = tops.entry(0);
  return top ? { topDict: reader.dict(top.start, top.end), globalSubrsAt: reader.index(tops.end).end } : null;
}

function openTables(sfnt: SfntFile, table: TableRecord, isCff2: boolean): CffFont | null {
  const { dv } = sfnt;
  const base = table.offset;
  const reader = new CffReader(dv, isCff2);
  const top = topDictOf(reader, base);
  if (!top) return null;
  const { topDict, globalSubrsAt } = top;
  const topOperands = topDict.operands;
  const charStringsAt = first(topOperands, OP_CHARSTRINGS);
  if (charStringsAt === undefined) return null;
  const charStrings = reader.index(base + charStringsAt);
  const globalSubrs = reader.index(globalSubrsAt);

  const fdArrayAt = first(topOperands, OP_FDARRAY);
  const fdSelectAt = first(topOperands, OP_FDSELECT);
  // FreeType reads the font dicts of a CFF only for a CID-keyed font, which the `ROS` operator marks.
  const isCidKeyed = fdArrayAt !== undefined && (isCff2 || topOperands.has(OP_ROS));
  const listedFontDicts = isCidKeyed ? fontDictsOf(reader, base + fdArrayAt) : [];
  // An empty FDArray leaves the Top DICT in charge, as it does in FreeType (`num_subfonts` is 0).
  const hasFontDicts = listedFontDicts.length > 0;
  const fontDicts = hasFontDicts ? listedFontDicts : [topDict];
  const privates = fontDicts.map((font) => privateOf(reader, base, font, isCff2));
  const fdOf =
    hasFontDicts && fdSelectAt !== undefined ? fdSelector(dv, base + fdSelectAt, charStrings.count) : () => 0;
  const matrices = resolveFontMatrices(
    topDict.fontMatrix,
    hasFontDicts ? fontDicts.map((font) => font.fontMatrix) : null,
    readHeadUnitsPerEm(sfnt)
  );

  const fontDictList = privates.map((priv, i): CffFontDict => ({
    private: priv,
    matrix: matrices.fontDicts[i]!,
  }));

  const charsetAt = first(topOperands, OP_CHARSET) ?? 0;
  const sids = isCff2 ? [] : charsetSids(dv, base, charsetAt, charStrings.count);
  if (!sids) return null;
  const varStoreAt = first(topOperands, OP_VARSTORE);
  const counts = varStoreAt === undefined ? [] : regionCounts(dv, base + varStoreAt + 2);
  return {
    dv,
    isCff2,
    charStrings,
    globalSubrs,
    unitsPerEm: matrices.top.unitsPerEm,
    fontDictOf: (glyphIndex) => fontDictList[fdOf(glyphIndex)] ?? null,
    glyphOfStandardCode: (code) => {
      if (code < 0 || code > 255) return null;
      const glyphIndex = sids.indexOf(standardEncodingSid(code));
      return glyphIndex < 0 ? null : glyphIndex;
    },
    regionCount: (vsindex) => counts[vsindex] ?? null,
  };
}

/**
 * Opens the `CFF ` or `CFF2` table of `sfnt`, or returns `null`, never throws, for a font with
 * neither, a header of another version or a structure that leaves the table.
 */
export function openCff(sfnt: SfntFile): CffFont | null {
  const cff2 = sfnt.tables.get('CFF2');
  const table = cff2 ?? sfnt.tables.get('CFF ');
  if (!table || table.offset + CFF1_HEADER_MIN_LENGTH > sfnt.dv.byteLength) return null;
  const major = sfnt.dv.getUint8(table.offset);
  const isCff2 = cff2 !== undefined;
  if (major !== (isCff2 ? 2 : 1) || (isCff2 && table.length < CFF2_HEADER_LENGTH)) return null;
  try {
    return openTables(sfnt, table, isCff2);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return null;
  }
}
