/**
 * Reads a TrueType font's glyph outlines the way Godot's text server hands them to TextMesh: the
 * glyph index of a character from `cmap` (formats 4 and 12), and the points of that glyph from
 * `glyf` and `loca`, scaled to a font size with FreeType's fixed-point arithmetic. A font with no
 * `glyf` table (OpenType-CFF, or a compressed container) gets no reader.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ContourPointTag } from '../../../../godot/text/textServerEnums';
import { ftMulFix, getFontOutlineScale } from './fontMetrics';
import { openSfnt, readUnitsPerEm, tableFits, type SfntFile } from './sfntTables';

/** One outline point, in px from the glyph origin with y down, as `font_get_glyph_contours` returns it. */
export interface ContourPoint {
  x: number;
  y: number;
  tag: (typeof ContourPointTag)[keyof typeof ContourPointTag];
}

/** What `TextServer::font_get_glyph_contours` returns for one glyph (`text_server_adv.cpp:3597-3652`). */
export interface GlyphContours {
  points: readonly ContourPoint[];
  /** The index of the last point of each contour. */
  contourEnds: readonly number[];
  /** `FT_Outline_Get_Orientation` is `FT_ORIENTATION_FILL_RIGHT`: the outer contours wind clockwise. */
  isFillRight: boolean;
}

export interface SfntOutlines {
  /** The glyph index `cmap` gives `codePoint`, or 0 for a character the font lacks. */
  glyphIndex(codePoint: number): number;
  /** The contours of a glyph at `fontSizePx`, or null for a glyph with no outline. */
  glyphContours(glyphIndex: number, fontSizePx: number): GlyphContours | null;
}

/** A glyph's points as FreeType holds them: 26.6 fixed point, y up. */
interface ScaledOutline {
  x: number[];
  y: number[];
  isOn: boolean[];
  contourEnds: number[];
}

const HEAD_INDEX_TO_LOC_FORMAT_OFFSET = 50;
const HEAD_TABLE_MIN_LENGTH = 52;
const MAXP_NUM_GLYPHS_OFFSET = 4;
const MAXP_TABLE_MIN_LENGTH = 6;
const LONG_LOCA_FORMAT = 1;

/**
 * The deepest chain of composite glyphs read. FreeType refuses a loop through its own recursion
 * limit (`ttgload.c`, `loader->recurse_count`), and a font that nests deeper is corrupt.
 */
const MAX_COMPOSITE_DEPTH = 16;

const SIMPLE_X_SHORT = 0x02;
const SIMPLE_Y_SHORT = 0x04;
const SIMPLE_REPEAT = 0x08;
const SIMPLE_X_SAME_OR_POSITIVE = 0x10;
const SIMPLE_Y_SAME_OR_POSITIVE = 0x20;
const SIMPLE_ON_CURVE = 0x01;

const COMPONENT_ARGS_ARE_WORDS = 0x0001;
const COMPONENT_ARGS_ARE_XY_VALUES = 0x0002;
const COMPONENT_HAS_SCALE = 0x0008;
const COMPONENT_MORE = 0x0020;
const COMPONENT_HAS_XY_SCALE = 0x0040;
const COMPONENT_HAS_2X2 = 0x0080;

/** An F2Dot14 matrix entry as the 16.16 `FT_Fixed` FreeType multiplies by (`ttgload.c`, `* 4`). */
const F2DOT14_TO_16_16 = 4;

/** `cmap` platform and encoding of each Unicode subtable, best first, as HarfBuzz ranks them (`hb-ot-cmap-table.hh`). */
const CMAP_SUBTABLE_RANK: readonly (readonly [platform: number, encoding: number])[] = [
  [3, 10],
  [0, 6],
  [0, 4],
  [3, 1],
  [0, 3],
  [0, 2],
  [0, 1],
  [0, 0],
];

const CMAP_FORMAT_SEGMENTED = 4;
const CMAP_FORMAT_GROUPED = 12;

function findCmapSubtable(dv: DataView, cmapOffset: number): number | null {
  const recordCount = dv.getUint16(cmapOffset + 2, false);
  for (const [platform, encoding] of CMAP_SUBTABLE_RANK) {
    for (let i = 0; i < recordCount; i++) {
      const record = cmapOffset + 4 + i * 8;
      if (dv.getUint16(record, false) !== platform || dv.getUint16(record + 2, false) !== encoding) continue;
      const subtable = cmapOffset + dv.getUint32(record + 4, false);
      const format = dv.getUint16(subtable, false);
      if (format === CMAP_FORMAT_SEGMENTED || format === CMAP_FORMAT_GROUPED) return subtable;
    }
  }
  return null;
}

/** Binary search for the first of `count` ascending entries whose end is at or above `target`. */
function firstEndAtOrAbove(count: number, endAt: (index: number) => number, target: number): number {
  let low = 0;
  let high = count;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (endAt(middle) < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** `cmap` format 4: segments of two-byte codes, each mapped by a delta or through a glyph-id array. */
function segmentedGlyphIndex(dv: DataView, subtable: number, codePoint: number): number {
  if (codePoint > 0xffff) return 0;
  const segmentCount = dv.getUint16(subtable + 6, false) / 2;
  const endCodes = subtable + 14;
  const startCodes = endCodes + segmentCount * 2 + 2;
  const idDeltas = startCodes + segmentCount * 2;
  const idRangeOffsets = idDeltas + segmentCount * 2;
  const segment = firstEndAtOrAbove(segmentCount, (i) => dv.getUint16(endCodes + i * 2, false), codePoint);
  if (segment >= segmentCount || dv.getUint16(startCodes + segment * 2, false) > codePoint) return 0;
  const idDelta = dv.getUint16(idDeltas + segment * 2, false);
  const rangeOffsetAt = idRangeOffsets + segment * 2;
  const rangeOffset = dv.getUint16(rangeOffsetAt, false);
  if (rangeOffset === 0) return (codePoint + idDelta) & 0xffff;
  const start = dv.getUint16(startCodes + segment * 2, false);
  const glyph = dv.getUint16(rangeOffsetAt + rangeOffset + (codePoint - start) * 2, false);
  return glyph === 0 ? 0 : (glyph + idDelta) & 0xffff;
}

/** `cmap` format 12: groups of consecutive code points mapped to consecutive glyphs. */
function groupedGlyphIndex(dv: DataView, subtable: number, codePoint: number): number {
  const groupCount = dv.getUint32(subtable + 12, false);
  const groups = subtable + 16;
  const group = firstEndAtOrAbove(groupCount, (i) => dv.getUint32(groups + i * 12 + 4, false), codePoint);
  if (group >= groupCount) return 0;
  const start = dv.getUint32(groups + group * 12, false);
  if (start > codePoint) return 0;
  return dv.getUint32(groups + group * 12 + 8, false) + (codePoint - start);
}

/** The glyph-index lookup of the best Unicode subtable of `cmap`, or null for a font with none we read. */
function cmapLookup(dv: DataView, cmapOffset: number): ((codePoint: number) => number) | null {
  const subtable = findCmapSubtable(dv, cmapOffset);
  if (subtable === null) return null;
  const read =
    dv.getUint16(subtable, false) === CMAP_FORMAT_SEGMENTED ? segmentedGlyphIndex : groupedGlyphIndex;
  return (codePoint) => read(dv, subtable, codePoint);
}

/**
 * Reads the flags of a simple glyph, expanding each repeat, and returns where the x deltas start.
 * A repeat that runs past `pointCount` is cut there: the axis readers would otherwise emit more
 * coordinates than the glyph has points.
 */
function readSimpleFlags(dv: DataView, start: number, pointCount: number): { flags: number[]; next: number } {
  const flags: number[] = [];
  let at = start;
  while (flags.length < pointCount) {
    const flag = dv.getUint8(at++);
    flags.push(flag);
    if (flag & SIMPLE_REPEAT) {
      for (let repeats = dv.getUint8(at++); repeats > 0 && flags.length < pointCount; repeats--)
        flags.push(flag);
    }
  }
  return { flags, next: at };
}

/** One axis of a simple glyph: a delta per point, a byte or a word or none, summed into coordinates. */
function readSimpleAxis(
  dv: DataView,
  start: number,
  flags: readonly number[],
  masks: { short: number; sameOrPositive: number }
): { coordinates: number[]; next: number } {
  const coordinates: number[] = [];
  let at = start;
  let value = 0;
  for (const flag of flags) {
    if (flag & masks.short) {
      const magnitude = dv.getUint8(at++);
      value += flag & masks.sameOrPositive ? magnitude : -magnitude;
    } else if (!(flag & masks.sameOrPositive)) {
      value += dv.getInt16(at, false);
      at += 2;
    }
    coordinates.push(value);
  }
  return { coordinates, next: at };
}

function readSimpleGlyph(dv: DataView, glyph: number, contourCount: number, scale: number): ScaledOutline {
  const contourEnds = Array.from({ length: contourCount }, (_, i) => dv.getUint16(glyph + 10 + i * 2, false));
  const pointCount = (contourEnds[contourCount - 1] ?? -1) + 1;
  const instructionLength = dv.getUint16(glyph + 10 + contourCount * 2, false);
  const { flags, next: xStart } = readSimpleFlags(
    dv,
    glyph + 12 + contourCount * 2 + instructionLength,
    pointCount
  );
  const x = readSimpleAxis(dv, xStart, flags, {
    short: SIMPLE_X_SHORT,
    sameOrPositive: SIMPLE_X_SAME_OR_POSITIVE,
  });
  const y = readSimpleAxis(dv, x.next, flags, {
    short: SIMPLE_Y_SHORT,
    sameOrPositive: SIMPLE_Y_SAME_OR_POSITIVE,
  });
  // The font stores design units: `FT_Load_Glyph` scales them to 26.6.
  return {
    x: x.coordinates.map((value) => ftMulFix(value, scale)),
    y: y.coordinates.map((value) => ftMulFix(value, scale)),
    isOn: flags.map((flag) => (flag & SIMPLE_ON_CURVE) !== 0),
    contourEnds,
  };
}

/** A 2x2 matrix as 16.16 fixed point, `[xx, xy, yx, yy]`. */
type Matrix2x2 = readonly [number, number, number, number];

/** A component's matrix, or null for the identity. */
function readComponentMatrix(
  dv: DataView,
  at: number,
  flags: number
): { matrix: Matrix2x2 | null; next: number } {
  const entry = (offset: number) => dv.getInt16(at + offset, false) * F2DOT14_TO_16_16;
  if (flags & COMPONENT_HAS_SCALE) {
    const scale = entry(0);
    return { matrix: [scale, 0, 0, scale], next: at + 2 };
  }
  if (flags & COMPONENT_HAS_XY_SCALE) return { matrix: [entry(0), 0, 0, entry(2)], next: at + 4 };
  if (flags & COMPONENT_HAS_2X2) {
    return { matrix: [entry(0), entry(4), entry(2), entry(6)], next: at + 8 };
  }
  return { matrix: null, next: at };
}

/** `FT_Vector_Transform` of every point of `outline` by `[xx, xy, yx, yy]`. */
function transformOutline(outline: ScaledOutline, [xx, xy, yx, yy]: Matrix2x2): void {
  for (let i = 0; i < outline.x.length; i++) {
    const x = outline.x[i]!;
    const y = outline.y[i]!;
    outline.x[i] = ftMulFix(x, xx) + ftMulFix(y, xy);
    outline.y[i] = ftMulFix(x, yx) + ftMulFix(y, yy);
  }
}

class GlyphReader {
  private readonly glyfTable: number;
  private readonly locaTable: number;
  private readonly isLongLoca: boolean;

  constructor(
    private readonly dv: DataView,
    private readonly glyphCount: number,
    tables: SfntFile['tables'],
    isLongLoca: boolean
  ) {
    this.glyfTable = tables.get('glyf')!.offset;
    this.locaTable = tables.get('loca')!.offset;
    this.isLongLoca = isLongLoca;
  }

  /** The glyph's `glyf` offset from its `loca` entry: a short entry stores half the offset, a long one the whole. */
  private locaEntry(glyphIndex: number): number {
    return this.isLongLoca
      ? this.dv.getUint32(this.locaTable + glyphIndex * 4, false)
      : this.dv.getUint16(this.locaTable + glyphIndex * 2, false) * 2;
  }

  /** The glyph's offset in `glyf`, or null for a glyph with no data. */
  private glyphOffset(glyphIndex: number): number | null {
    if (glyphIndex < 0 || glyphIndex >= this.glyphCount) return null;
    const start = this.locaEntry(glyphIndex);
    return this.locaEntry(glyphIndex + 1) > start ? this.glyfTable + start : null;
  }

  /** The glyph's points in 26.6 fixed point, y up, with a composite resolved to its components. */
  load(glyphIndex: number, scale: number, depth = 0): ScaledOutline | null {
    const glyph = this.glyphOffset(glyphIndex);
    if (glyph === null || depth > MAX_COMPOSITE_DEPTH) return null;
    const contourCount = this.dv.getInt16(glyph, false);
    if (contourCount >= 0) return readSimpleGlyph(this.dv, glyph, contourCount, scale);
    return this.loadComposite(glyph + 10, scale, depth);
  }

  private loadComposite(start: number, scale: number, depth: number): ScaledOutline {
    const whole: ScaledOutline = { x: [], y: [], isOn: [], contourEnds: [] };
    let at = start;
    let flags: number;
    do {
      flags = this.dv.getUint16(at, false);
      const componentIndex = this.dv.getUint16(at + 2, false);
      const arguments_ = this.readComponentArguments(at + 4, flags);
      const { matrix, next } = readComponentMatrix(this.dv, arguments_.next, flags);
      at = next;

      const component = this.load(componentIndex, scale, depth + 1);
      if (!component) continue;
      if (matrix) transformOutline(component, matrix);
      const [first, second] = arguments_.values;
      const [dx, dy] =
        flags & COMPONENT_ARGS_ARE_XY_VALUES
          ? [ftMulFix(first, scale), ftMulFix(second, scale)]
          : [whole.x[first]! - component.x[second]!, whole.y[first]! - component.y[second]!];
      appendOutline(whole, component, dx, dy);
    } while (flags & COMPONENT_MORE);
    return whole;
  }

  /**
   * The two arguments of a component: a signed offset in design units, or with the XY flag clear
   * the unsigned numbers of the point to match in the glyph so far and in the component.
   */
  private readComponentArguments(at: number, flags: number): { values: [number, number]; next: number } {
    const isXyOffset = (flags & COMPONENT_ARGS_ARE_XY_VALUES) !== 0;
    if (flags & COMPONENT_ARGS_ARE_WORDS) {
      const read = (offset: number) =>
        isXyOffset ? this.dv.getInt16(offset, false) : this.dv.getUint16(offset, false);
      return { values: [read(at), read(at + 2)], next: at + 4 };
    }
    const read = (offset: number) => (isXyOffset ? this.dv.getInt8(offset) : this.dv.getUint8(offset));
    return { values: [read(at), read(at + 1)], next: at + 2 };
  }
}

function appendOutline(whole: ScaledOutline, part: ScaledOutline, dx: number, dy: number): void {
  const firstPoint = whole.x.length;
  for (let i = 0; i < part.x.length; i++) {
    whole.x.push(part.x[i]! + dx);
    whole.y.push(part.y[i]! + dy);
    whole.isOn.push(part.isOn[i]!);
  }
  for (const end of part.contourEnds) whole.contourEnds.push(firstPoint + end);
}

/**
 * `FT_Outline_Get_Orientation` is `FT_ORIENTATION_FILL_RIGHT` (`ftoutln.c`): the sign of the
 * area the control polygon spans over every contour. Collapsed in x or y, it is neither.
 */
function isFillRight(outline: ScaledOutline): boolean {
  const hasWidth = Math.max(...outline.x) !== Math.min(...outline.x);
  const hasHeight = Math.max(...outline.y) !== Math.min(...outline.y);
  if (!hasWidth || !hasHeight) return false;
  let area = 0;
  let first = 0;
  for (const last of outline.contourEnds) {
    let previous = last;
    for (let i = first; i <= last; i++) {
      area += (outline.y[i]! - outline.y[previous]!) * (outline.x[i]! + outline.x[previous]!);
      previous = i;
    }
    first = last + 1;
  }
  return area < 0;
}

const FIXED_26_6 = 64;

function toContours(outline: ScaledOutline): GlyphContours {
  const points = outline.x.map((x, i): ContourPoint => ({
    x: x / FIXED_26_6,
    y: -outline.y[i]! / FIXED_26_6,
    tag: outline.isOn[i] ? ContourPointTag.ON : ContourPointTag.OFF_CONIC,
  }));
  return { points, contourEnds: outline.contourEnds, isFillRight: isFillRight(outline) };
}

/** `read`, or `fallback` when a corrupt table puts an offset past the buffer: a `DataView` read throws a `RangeError` there. */
function orOnRangeError<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return fallback;
  }
}

/**
 * Reads the outlines of a TrueType font, or returns `null`, never throws, for a font with no
 * `glyf` table, no readable `cmap` or a table that does not fit its buffer. The reader answers
 * no glyph, not an error, for an offset a corrupt table puts past the buffer.
 */
export function parseSfntOutlines(bytes: ArrayBuffer): SfntOutlines | null {
  const sfnt = openSfnt(bytes);
  if (!sfnt) return null;
  const { dv, tables } = sfnt;
  const head = tables.get('head');
  const maxp = tables.get('maxp');
  const cmap = tables.get('cmap');
  if (!head || !maxp || !cmap || !tables.has('glyf') || !tables.has('loca')) return null;
  if (!tableFits(dv, head, HEAD_TABLE_MIN_LENGTH) || !tableFits(dv, maxp, MAXP_TABLE_MIN_LENGTH)) return null;

  const unitsPerEm = readUnitsPerEm(dv, head);
  const isLongLoca = dv.getInt16(head.offset + HEAD_INDEX_TO_LOC_FORMAT_OFFSET, false) === LONG_LOCA_FORMAT;
  const glyphCount = dv.getUint16(maxp.offset + MAXP_NUM_GLYPHS_OFFSET, false);
  if (unitsPerEm === 0) return null;
  const lookup = orOnRangeError(() => cmapLookup(dv, cmap.offset), null);
  if (!lookup) return null;

  const glyphs = new GlyphReader(dv, glyphCount, tables, isLongLoca);
  return {
    glyphIndex: (codePoint) => orOnRangeError(() => lookup(codePoint), 0),
    glyphContours: (glyphIndex, fontSizePx) =>
      orOnRangeError(() => {
        const outline = glyphs.load(glyphIndex, getFontOutlineScale(unitsPerEm, fontSizePx));
        return outline && outline.x.length > 0 ? toContours(outline) : null;
      }, null),
  };
}
