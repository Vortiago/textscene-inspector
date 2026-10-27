/**
 * Reads the outline of a glyph from the `glyf` and `loca` tables of a TrueType font, simple or
 * composite, scaled to a font size with FreeType's fixed-point arithmetic.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ContourPointTag } from '../../../../godot/text/textServerEnums';
import { ftMulFix, getFontOutlineScale } from './fontMetrics';
import {
  scaledOutlineContours,
  transformOutline,
  type GlyphContourReader,
  type Matrix2x2,
  type ScaledOutline,
} from './glyphContours';
import { readUnitsPerEm, tableFits, type SfntFile } from './sfntTables';

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
    tags: flags.map((flag) => (flag & SIMPLE_ON_CURVE ? ContourPointTag.ON : ContourPointTag.OFF_CONIC)),
    contourEnds,
  };
}

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
    const whole: ScaledOutline = { x: [], y: [], tags: [], contourEnds: [] };
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
    whole.tags.push(part.tags[i]!);
  }
  for (const end of part.contourEnds) whole.contourEnds.push(firstPoint + end);
}

/**
 * The glyph-contour reader of a font's `glyf` outlines, or null for a font with no `glyf` or `loca`
 * table, or a `head` or `maxp` that does not fit. A corrupt table that puts an offset past the
 * buffer reads as a glyph with no outline.
 */
export function glyphContourReader({ dv, tables }: SfntFile): GlyphContourReader | null {
  const head = tables.get('head');
  const maxp = tables.get('maxp');
  if (!head || !maxp || !tables.has('glyf') || !tables.has('loca')) return null;
  if (!tableFits(dv, head, HEAD_TABLE_MIN_LENGTH) || !tableFits(dv, maxp, MAXP_TABLE_MIN_LENGTH)) return null;

  const unitsPerEm = readUnitsPerEm(dv, head);
  if (unitsPerEm === 0) return null;
  const isLongLoca = dv.getInt16(head.offset + HEAD_INDEX_TO_LOC_FORMAT_OFFSET, false) === LONG_LOCA_FORMAT;
  const glyphCount = dv.getUint16(maxp.offset + MAXP_NUM_GLYPHS_OFFSET, false);
  const glyphs = new GlyphReader(dv, glyphCount, tables, isLongLoca);
  return (glyphIndex, fontSizePx) => {
    const outline = glyphs.load(glyphIndex, getFontOutlineScale(unitsPerEm, fontSizePx));
    return outline && outline.x.length > 0 ? scaledOutlineContours(outline) : null;
  };
}
