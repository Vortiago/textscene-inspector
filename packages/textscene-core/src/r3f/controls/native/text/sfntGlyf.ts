/**
 * Loads the outline of a glyph from the `glyf` and `loca` tables of a TrueType font as FreeType's
 * TrueType driver does for Godot (`ttgload.c`, `load_truetype_glyph`): simple or composite, scaled
 * to a font size with FreeType's fixed-point arithmetic, and hinted by the font's own instructions
 * when a hinter (`glyphHinting.ts`) is given. Each glyph ends in four phantom points, which mark
 * its side bearings and advances and which the instructions may move.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { freeTypeTrueTypeSize, ftMulFix } from './fontMetrics';
import { ftVectorLength } from './ftVector';
import {
  transformOutline,
  type ContourTag,
  type GlyphOutlineReader,
  type Matrix2x2,
  type ScaledOutline,
} from './glyphContours';
import type { GlyphHinting, GlyphLoadHinter } from './glyphHinting';
import {
  COMPONENT_ARGS_ARE_WORDS,
  COMPONENT_ARGS_ARE_XY_VALUES,
  COMPONENT_HAS_2X2,
  COMPONENT_HAS_INSTRUCTIONS,
  COMPONENT_HAS_SCALE,
  COMPONENT_HAS_XY_SCALE,
  COMPONENT_MORE,
  COMPONENT_ROUND_XY_TO_GRID,
  COMPONENT_SCALED_OFFSET,
  COMPONENT_USE_MY_METRICS,
  LONG_LOCA_FORMAT,
  SIMPLE_ON_CURVE,
  SIMPLE_REPEAT,
  SIMPLE_X_SAME_OR_POSITIVE,
  SIMPLE_X_SHORT,
  SIMPLE_Y_SAME_OR_POSITIVE,
  SIMPLE_Y_SHORT,
  componentArgumentByteCount,
  componentMatrixByteCount,
} from './glyfFormat';
import { glyphMetricsReader, type GlyphMetrics } from './sfntGlyphMetrics';
import { readUnitsPerEm, tableFits, type SfntFile } from './sfntTables';
import { pixRound } from './truetype/ttArithmetic';
import { PHANTOM_POINT_COUNT, TAG_TOUCH_BOTH, type GlyphZone } from './truetype/ttZone';

/** `head`: flags(2) at 16, whose bit 3 rounds the ppem; indexToLocFormat(2) at 50. */
const HEAD_FLAGS_OFFSET = 16;
const HEAD_FLAG_PPEM_ROUNDED = 0x8;
const HEAD_INDEX_TO_LOC_FORMAT_OFFSET = 50;
const HEAD_TABLE_MIN_LENGTH = 52;
const MAXP_NUM_GLYPHS_OFFSET = 4;
const MAXP_TABLE_MIN_LENGTH = 6;

/** A glyph's header: numberOfContours(2), then xMin, yMin, xMax and yMax(2 each). */
const GLYPH_HEADER_SIZE = 10;
/** FreeType's arbitrary limit on nested composites. */
const MAX_COMPOSITE_DEPTH = 100;
/** The contour count FreeType refuses for a simple glyph. */
const MAX_SIMPLE_CONTOURS = 0xfff;
/** An F2Dot14 matrix entry as the 16.16 `FT_Fixed` FreeType multiplies by (`* 4`). */
const F2DOT14_TO_16_16 = 4;
/** `FT_CURVE_TAG`: the bits of a tag that say what kind of point it is, which Godot reads. */
const CURVE_TAG_MASK = 0x3;

/** A FreeType error that fails the whole glyph load, so Godot draws no outline for the glyph. */
class GlyphLoadError extends Error {}

/** A bounded reader over one glyph's bytes, which fails the load with `error` past its end. */
class GlyphCursor {
  constructor(
    private readonly dv: DataView,
    public at: number,
    private readonly limit: number,
    private readonly error: string
  ) {}

  need(byteCount: number): void {
    if (this.at + byteCount > this.limit) throw new GlyphLoadError(this.error);
  }

  u8(): number {
    this.need(1);
    return this.dv.getUint8(this.at++);
  }

  i8(): number {
    this.need(1);
    return this.dv.getInt8(this.at++);
  }

  u16(): number {
    this.need(2);
    const value = this.dv.getUint16(this.at, false);
    this.at += 2;
    return value;
  }

  i16(): number {
    this.need(2);
    const value = this.dv.getInt16(this.at, false);
    this.at += 2;
    return value;
  }

  bytes(length: number, error: string): Uint8Array {
    if (this.at + length > this.limit) throw new GlyphLoadError(error);
    const bytes = new Uint8Array(this.dv.buffer, this.dv.byteOffset + this.at, length).slice();
    this.at += length;
    return bytes;
  }
}

/** The four phantom points: left and right side bearing, then top and bottom, in 26.6 once scaled. */
interface PhantomPoints {
  x: number[];
  y: number[];
}

interface GlyphHeader {
  contourCount: number;
  xMin: number;
  yMax: number;
}

/** One component of a composite glyph (`TT_Load_Composite_Glyph`). */
interface Component {
  flags: number;
  glyphIndex: number;
  /** A signed offset in font units, or with the XY flag clear the numbers of the points to match. */
  arguments: [number, number];
  matrix: Matrix2x2 | null;
}

/** The tables and facts of a font that every glyph load reads. */
interface GlyfFont {
  dv: DataView;
  glyfOffset: number;
  glyfLength: number;
  locaOffset: number;
  locationCount: number;
  isLongLoca: boolean;
  glyphCount: number;
  metricsOf: (glyphIndex: number, yMax: number) => GlyphMetrics;
}

/** `tt_face_get_location`: the glyph's offset in `glyf` and its length, 0 for none or a broken entry. */
function glyphLocation(font: GlyfFont, glyphIndex: number): { offset: number; length: number } {
  const { dv, locaOffset, locationCount, isLongLoca, glyfLength } = font;
  let start = 0;
  let end = 0;
  if (glyphIndex < locationCount) {
    const entry = (index: number) =>
      isLongLoca
        ? dv.getUint32(locaOffset + index * 4, false)
        : dv.getUint16(locaOffset + index * 2, false) * 2;
    start = entry(glyphIndex);
    end = glyphIndex + 1 < locationCount ? entry(glyphIndex + 1) : start;
  }
  if (start > glyfLength) return { offset: 0, length: 0 };
  if (end > glyfLength) {
    // The last entry may run past the table, and is cut at its end.
    if (glyphIndex !== locationCount - 2) return { offset: 0, length: 0 };
    end = glyfLength;
  }
  return { offset: start, length: end >= start ? end - start : glyfLength - start };
}

/** `tt_loader_set_pp`: the phantom points in font units. The v40 interpreter centres the top and bottom ones. */
function phantomPoints({ xMin, yMax }: GlyphHeader, { horizontal, vertical }: GlyphMetrics): PhantomPoints {
  const left = xMin - horizontal.bearing;
  const top = yMax + vertical.bearing;
  const centre = Math.trunc(horizontal.advance / 2);
  return { x: [left, left + horizontal.advance, centre, centre], y: [0, 0, top, top - vertical.advance] };
}

/** The flags of each point of a simple glyph, a repeat expanded, which may not run past the last point. */
function readSimpleFlags(cursor: GlyphCursor, pointCount: number): number[] {
  const flags: number[] = [];
  while (flags.length < pointCount) {
    const flag = cursor.u8();
    flags.push(flag);
    if (!(flag & SIMPLE_REPEAT)) continue;
    const repeats = cursor.u8();
    if (flags.length + repeats > pointCount) throw new GlyphLoadError('Invalid_Outline');
    for (let k = 0; k < repeats; k++) flags.push(flag);
  }
  return flags;
}

/** One axis of a simple glyph: a delta per point, a byte or a word or none, summed into coordinates. */
function readSimpleAxis(
  cursor: GlyphCursor,
  flags: readonly number[],
  masks: { short: number; sameOrPositive: number }
): number[] {
  let value = 0;
  return flags.map((flag) => {
    if (flag & masks.short) {
      const magnitude = cursor.u8();
      value += flag & masks.sameOrPositive ? magnitude : -magnitude;
    } else if (!(flag & masks.sameOrPositive)) value += cursor.i16();
    return value;
  });
}

/** A simple glyph in font units (`TT_Load_Simple_Glyph`), with its instructions. */
interface SimpleGlyph {
  x: number[];
  y: number[];
  tags: number[];
  contourEnds: number[];
  instructions: Uint8Array;
}

function readSimpleGlyph(cursor: GlyphCursor, contourCount: number): SimpleGlyph {
  if (contourCount >= MAX_SIMPLE_CONTOURS) throw new GlyphLoadError('Invalid_Outline');
  cursor.need(2 * contourCount + 2);
  const contourEnds: number[] = [];
  for (let contour = 0, last = -1; contour < contourCount; contour++) {
    const end = cursor.u16();
    if (end <= last) throw new GlyphLoadError('Invalid_Outline');
    contourEnds.push((last = end));
  }
  const pointCount = contourEnds[contourCount - 1]! + 1;
  const instructions = cursor.bytes(cursor.u16(), 'Too_Many_Hints');
  const flags = readSimpleFlags(cursor, pointCount);
  const x = readSimpleAxis(cursor, flags, {
    short: SIMPLE_X_SHORT,
    sameOrPositive: SIMPLE_X_SAME_OR_POSITIVE,
  });
  const y = readSimpleAxis(cursor, flags, {
    short: SIMPLE_Y_SHORT,
    sameOrPositive: SIMPLE_Y_SAME_OR_POSITIVE,
  });
  return { x, y, tags: flags.map((flag) => flag & SIMPLE_ON_CURVE), contourEnds, instructions };
}

/** A component's matrix, or null for the identity. */
function readComponentMatrix(cursor: GlyphCursor, flags: number): Matrix2x2 | null {
  const entry = () => cursor.i16() * F2DOT14_TO_16_16;
  if (flags & COMPONENT_HAS_SCALE) {
    const scale = entry();
    return [scale, 0, 0, scale];
  }
  if (flags & COMPONENT_HAS_XY_SCALE) {
    const xx = entry();
    return [xx, 0, 0, entry()];
  }
  if (flags & COMPONENT_HAS_2X2) {
    const [xx, yx, xy, yy] = [entry(), entry(), entry(), entry()];
    return [xx, xy, yx, yy];
  }
  return null;
}

/** The two arguments of a component: signed offsets, or with the XY flag clear unsigned point numbers. */
function readComponentArguments(cursor: GlyphCursor, flags: number): [number, number] {
  const isOffset = (flags & COMPONENT_ARGS_ARE_XY_VALUES) !== 0;
  const read =
    flags & COMPONENT_ARGS_ARE_WORDS
      ? () => (isOffset ? cursor.i16() : cursor.u16())
      : () => (isOffset ? cursor.i8() : cursor.u8());
  return [read(), read()];
}

/** `TT_Load_Composite_Glyph`: the components, and where the composite's instructions start. */
function readComponents(
  cursor: GlyphCursor,
  glyphCount: number
): { components: Component[]; instructionsAt: number } {
  const components: Component[] = [];
  let flags: number;
  do {
    cursor.need(4);
    flags = cursor.u16();
    const glyphIndex = cursor.u16();
    if (glyphIndex >= glyphCount) throw new GlyphLoadError('Invalid_Composite');
    cursor.need(componentArgumentByteCount(flags) + componentMatrixByteCount(flags));
    const args = readComponentArguments(cursor, flags);
    components.push({ flags, glyphIndex, arguments: args, matrix: readComponentMatrix(cursor, flags) });
  } while (flags & COMPONENT_MORE);
  return { components, instructionsAt: cursor.at };
}

/** Points in 26.6 with FreeType's tags, and the last point of each contour. */
interface OutlinePoints {
  x: number[];
  y: number[];
  tags: number[];
  contourEnds: number[];
}

/** The zone of the points from `firstPoint` of `outline` and the phantom points after them (`tt_prepare_zone`). */
function zoneOf(
  outline: OutlinePoints,
  firstPoint: number,
  firstContour: number,
  phantoms: PhantomPoints
): GlyphZone {
  const x = [...outline.x.slice(firstPoint), ...phantoms.x];
  const y = [...outline.y.slice(firstPoint), ...phantoms.y];
  const tags = [...outline.tags.slice(firstPoint), ...new Array<number>(PHANTOM_POINT_COUNT).fill(0)];
  return {
    pointCount: x.length,
    contourCount: outline.contourEnds.length - firstContour,
    orgX: new Float64Array(x.length),
    orgY: new Float64Array(x.length),
    curX: Float64Array.from(x),
    curY: Float64Array.from(y),
    orusX: new Float64Array(x.length),
    orusY: new Float64Array(x.length),
    tags: Uint8Array.from(tags),
    contourEnds: outline.contourEnds.slice(firstContour),
    firstPoint,
  };
}

/** The phantom points a zone ends in. */
function zonePhantoms(zone: GlyphZone): PhantomPoints {
  const first = zone.pointCount - PHANTOM_POINT_COUNT;
  return { x: Array.from(zone.curX.subarray(first)), y: Array.from(zone.curY.subarray(first)) };
}

/** One `FT_Load_Glyph` of a TrueType glyph: the outline it builds, and the loader's phantom points. */
class GlyphLoad {
  readonly x: number[] = [];
  readonly y: number[] = [];
  /** FreeType's tags, with the touch flags the instructions set. */
  readonly tags: number[] = [];
  readonly contourEnds: number[] = [];
  phantoms: PhantomPoints = { x: [0, 0, 0, 0], y: [0, 0, 0, 0] };
  /** The composite glyph of each nesting level above the glyph loading, which no component may repeat. */
  private readonly composites: number[] = [];

  constructor(
    private readonly font: GlyfFont,
    private readonly scale: number,
    private readonly hinter: GlyphLoadHinter | null
  ) {}

  /** `load_truetype_glyph`: appends the glyph's points, or throws the error that fails the load. */
  load(glyphIndex: number, depth: number): void {
    if (depth > MAX_COMPOSITE_DEPTH) throw new GlyphLoadError('Invalid_Composite');
    if (glyphIndex >= this.font.glyphCount) throw new GlyphLoadError('Invalid_Glyph_Index');
    const { offset, length } = glyphLocation(this.font, glyphIndex);
    const start = this.font.glyfOffset + offset;
    const header = this.readHeader(start, length);
    this.phantoms = phantomPoints(header, this.font.metricsOf(glyphIndex, header.yMax));
    if (header.contourCount === 0) {
      this.phantoms = this.scaled(this.phantoms);
      return;
    }
    const body = (error: string) =>
      new GlyphCursor(this.font.dv, start + GLYPH_HEADER_SIZE, start + length, error);
    if (header.contourCount > 0)
      this.loadSimple(readSimpleGlyph(body('Invalid_Outline'), header.contourCount));
    else this.loadComposite(glyphIndex, depth, body('Invalid_Composite'), length);
  }

  /** `TT_Load_Glyph_Header`, with a glyph of no bytes read as one of no contours at the origin. */
  private readHeader(start: number, length: number): GlyphHeader {
    if (length === 0) return { contourCount: 0, xMin: 0, yMax: 0 };
    const cursor = new GlyphCursor(this.font.dv, start, start + length, 'Invalid_Outline');
    const contourCount = cursor.i16();
    const xMin = cursor.i16();
    cursor.i16();
    cursor.i16();
    const yMax = cursor.i16();
    return contourCount === 0 ? { contourCount, xMin: 0, yMax: 0 } : { contourCount, xMin, yMax };
  }

  private scaled({ x, y }: PhantomPoints): PhantomPoints {
    return {
      x: x.map((value) => ftMulFix(value, this.scale)),
      y: y.map((value) => ftMulFix(value, this.scale)),
    };
  }

  /** `TT_Process_Simple_Glyph`: scales the glyph, hints it, and appends it with its contours renumbered. */
  private loadSimple(glyph: SimpleGlyph): void {
    const pointCount = glyph.x.length;
    const unscaled = { x: [...glyph.x, ...this.phantoms.x], y: [...glyph.y, ...this.phantoms.y] };
    const scaled = this.scaled(unscaled);
    this.phantoms = { x: scaled.x.slice(pointCount), y: scaled.y.slice(pointCount) };
    const points: OutlinePoints = {
      x: scaled.x.slice(0, pointCount),
      y: scaled.y.slice(0, pointCount),
      tags: glyph.tags,
      contourEnds: glyph.contourEnds,
    };
    this.append(this.hinter ? this.hintSimple(points, unscaled, glyph.instructions) : points);
  }

  /** The points of a simple glyph once its instructions have run, which see the unscaled points too. */
  private hintSimple(
    points: OutlinePoints,
    unscaled: PhantomPoints,
    instructions: Uint8Array
  ): OutlinePoints {
    const zone = zoneOf(points, 0, 0, this.phantoms);
    zone.orusX.set(unscaled.x);
    zone.orusY.set(unscaled.y);
    this.hint(zone, instructions, false);
    const pointCount = points.x.length;
    return {
      x: Array.from(zone.curX.subarray(0, pointCount)),
      y: Array.from(zone.curY.subarray(0, pointCount)),
      tags: Array.from(zone.tags.subarray(0, pointCount)),
      contourEnds: points.contourEnds,
    };
  }

  /** `FT_GlyphLoader_Add`: the points after those loaded, their contours numbered in the whole outline. */
  private append({ x, y, tags, contourEnds }: OutlinePoints): void {
    const firstPoint = this.x.length;
    this.x.push(...x);
    this.y.push(...y);
    this.tags.push(...tags);
    for (const end of contourEnds) this.contourEnds.push(firstPoint + end);
  }

  /** `TT_Hint_Glyph`'s part in the loader: the hinted phantom points stand, but under backward compatibility. */
  private hint(zone: GlyphZone, instructions: Uint8Array, isComposite: boolean): void {
    this.hinter!.hint(zone, instructions, isComposite);
    if (!this.hinter!.isBackwardCompatible) this.phantoms = zonePhantoms(zone);
  }

  /**
   * Loads each component in turn, each with its own phantom points, which a component with
   * USE_MY_METRICS hands to the composite. A composite in its own chain is an error.
   */
  private loadComposite(glyphIndex: number, depth: number, cursor: GlyphCursor, byteLength: number): void {
    this.composites.length = depth;
    if (this.composites.includes(glyphIndex)) throw new GlyphLoadError('Invalid_Composite');
    this.composites[depth] = glyphIndex;

    const { components, instructionsAt } = readComponents(cursor, this.font.glyphCount);
    this.phantoms = this.scaled(this.phantoms);
    const firstPoint = this.x.length;
    const firstContour = this.contourEnds.length;
    for (const component of components) {
      const phantoms = this.phantoms;
      const basePointCount = this.x.length;
      this.load(component.glyphIndex, depth + 1);
      if (!(component.flags & COMPONENT_USE_MY_METRICS)) this.phantoms = phantoms;
      if (this.x.length !== basePointCount) this.placeComponent(component, firstPoint, basePointCount);
    }
    const last = components[components.length - 1]!;
    if (this.hinter && last.flags & COMPONENT_HAS_INSTRUCTIONS && this.x.length > firstPoint)
      this.hintComposite(firstPoint, firstContour, instructionsAt, byteLength);
  }

  /**
   * `TT_Process_Composite_Component`: transforms the component's points, then moves them by an
   * offset or so that two points match. A scaled offset scales by the matrix too, and a hinted
   * offset rounds to the grid, x only without backward compatibility.
   */
  private placeComponent(
    { flags, arguments: [first, second], matrix }: Component,
    firstPoint: number,
    componentStart: number
  ): void {
    if (matrix) transformOutline(this, matrix, componentStart);
    let dx: number;
    let dy: number;
    if (!(flags & COMPONENT_ARGS_ARE_XY_VALUES)) {
      const target = first + firstPoint;
      const own = second + componentStart;
      if (target >= componentStart || own >= this.x.length) throw new GlyphLoadError('Invalid_Composite');
      dx = this.x[target]! - this.x[own]!;
      dy = this.y[target]! - this.y[own]!;
    } else {
      if (first === 0 && second === 0) return;
      [dx, dy] = [first, second];
      if (matrix && flags & COMPONENT_SCALED_OFFSET) {
        const [xx, xy, yx, yy] = matrix;
        dx = ftMulFix(dx, ftVectorLength({ x: xx, y: xy }));
        dy = ftMulFix(dy, ftVectorLength({ x: yy, y: yx }));
      }
      dx = ftMulFix(dx, this.scale);
      dy = ftMulFix(dy, this.scale);
      if (flags & COMPONENT_ROUND_XY_TO_GRID && this.hinter) {
        if (!this.hinter.isBackwardCompatible) dx = pixRound(dx);
        dy = pixRound(dy);
      }
    }
    for (let point = componentStart; point < this.x.length; point++) {
      this.x[point] = this.x[point]! + dx;
      this.y[point] = this.y[point]! + dy;
    }
  }

  /**
   * `TT_Process_Composite_Glyph`: runs the composite's own instructions on all its points, untouched
   * first, with the composite's phantom points after them.
   */
  private hintComposite(
    firstPoint: number,
    firstContour: number,
    instructionsAt: number,
    byteLength: number
  ): void {
    const { dv } = this.font;
    const instructionCount = dv.getUint16(instructionsAt, false);
    if (instructionCount === 0) return;
    if (instructionCount > byteLength) throw new GlyphLoadError('Too_Many_Hints');
    const instructions = new Uint8Array(
      dv.buffer,
      dv.byteOffset + instructionsAt + 2,
      instructionCount
    ).slice();
    const zone = zoneOf(this, firstPoint, firstContour, this.phantoms);
    for (let point = 0; point < zone.pointCount - PHANTOM_POINT_COUNT; point++)
      zone.tags[point] = zone.tags[point]! & ~TAG_TOUCH_BOTH;
    this.hint(zone, instructions, true);
    for (let point = firstPoint; point < this.x.length; point++) {
      this.x[point] = zone.curX[point - firstPoint]!;
      this.y[point] = zone.curY[point - firstPoint]!;
      this.tags[point] = zone.tags[point - firstPoint]!;
    }
  }

  /** `TT_Load_Glyph`'s end: the outline moved so that the left side bearing point is the origin. */
  outline(): ScaledOutline {
    const [left] = this.phantoms.x as [number];
    return {
      x: left === 0 ? this.x : this.x.map((value) => value - left),
      y: this.y,
      tags: this.tags.map((tag) => (tag & CURVE_TAG_MASK) as ContourTag),
      contourEnds: this.contourEnds,
    };
  }
}

/** The tables of a font's `glyf` outlines, or null for a font without them or with a `head` or `maxp` that does not fit. */
function glyfFont(sfnt: SfntFile): GlyfFont | null {
  const { dv, tables } = sfnt;
  const head = tables.get('head');
  const maxp = tables.get('maxp');
  const glyf = tables.get('glyf');
  const loca = tables.get('loca');
  if (!head || !maxp || !glyf || !loca) return null;
  if (!tableFits(dv, head, HEAD_TABLE_MIN_LENGTH) || !tableFits(dv, maxp, MAXP_TABLE_MIN_LENGTH)) return null;
  const isLongLoca = dv.getInt16(head.offset + HEAD_INDEX_TO_LOC_FORMAT_OFFSET, false) === LONG_LOCA_FORMAT;
  return {
    dv,
    glyfOffset: glyf.offset,
    glyfLength: glyf.length,
    locaOffset: loca.offset,
    locationCount: Math.floor(loca.length / (isLongLoca ? 4 : 2)),
    isLongLoca,
    glyphCount: dv.getUint16(maxp.offset + MAXP_NUM_GLYPHS_OFFSET, false),
    metricsOf: glyphMetricsReader(sfnt),
  };
}

/**
 * The glyph-outline reader of a font's `glyf` outlines, hinted by `hinting` when given, or null for
 * a font with no `glyf` or `loca` table, or a `head` or `maxp` that does not fit. A glyph that
 * FreeType fails to load, and one of no points, has no outline.
 */
export function glyphOutlineReader(
  sfnt: SfntFile,
  hinting: GlyphHinting | null = null
): GlyphOutlineReader | null {
  const font = glyfFont(sfnt);
  if (!font) return null;
  const head = sfnt.tables.get('head')!;
  const unitsPerEm = readUnitsPerEm(sfnt.dv, head);
  if (unitsPerEm === 0) return null;
  const isPpemRounded =
    (sfnt.dv.getUint16(head.offset + HEAD_FLAGS_OFFSET, false) & HEAD_FLAG_PPEM_ROUNDED) !== 0;
  return (glyphIndex, fontSizePx) => {
    const { scale, ppem } = freeTypeTrueTypeSize(unitsPerEm, fontSizePx, isPpemRounded);
    const hinter = hinting ? hinting.beginLoad(ppem, scale) : null;
    if (hinter === 'failed') return null;
    const load = new GlyphLoad(font, scale, hinter);
    try {
      load.load(glyphIndex, 0);
    } catch (error) {
      if (!(error instanceof GlyphLoadError)) throw error;
      return null;
    }
    return load.x.length > 0 ? load.outline() : null;
  };
}
