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

import { ByteReader, ReadPastEndError } from '../../../../resources/formats/binaryresource/byteReader';
import { toInt16 } from '../../../../godot/variant/intWidth';
import { FIXED_16_16_ONE, freeTypeTrueTypeSize, ftMulFix, pixRound } from './fontMetrics';
import { ftVectorLength } from './ftVector';
import {
  transformOutline,
  type ContourTag,
  type GlyphOutlineReader,
  type Matrix2x2,
  type ScaledOutline,
  type UnscaledOutlines,
} from './glyphContours';
import {
  newGlyphZone,
  PHANTOM_POINT_COUNT,
  TAG_TOUCH_BOTH,
  type GlyphHinting,
  type GlyphLoadHinter,
  type GlyphZone,
} from './glyphHinting';
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
  GLYPH_HEADER_SIZE,
  GLYPH_Y_MAX_OFFSET,
  GLYPH_Y_MIN_OFFSET,
  LONG_LOCA_FORMAT,
  SIMPLE_ON_CURVE,
  SIMPLE_REPEAT,
  SIMPLE_X_SAME_OR_POSITIVE,
  SIMPLE_X_SHORT,
  SIMPLE_Y_SAME_OR_POSITIVE,
  SIMPLE_Y_SHORT,
  locaEntry,
} from './glyfFormat';
import { glyphMetricsReader, metricsAtInstance, type GlyphMetrics } from './sfntGlyphMetrics';
import {
  readGlyphCount,
  readHeadIsPpemRounded,
  readIndexToLocFormat,
  readUnitsPerEm,
  tableFits,
  type SfntFile,
} from './sfntTables';
import type { FontInstance } from './variation/fontInstance';
import type { ContourBox } from './strike/sbixGlyph';
import { variedGlyphPoints, type GlyphPoints, type VariedPoints } from './variation/gvar';
import { InvalidTupleVariationsError } from './variation/tupleVariations';

/** `head` through indexToLocFormat. */
const HEAD_TABLE_MIN_LENGTH = 52;

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

/** `read`, where a read past the glyph's bytes fails the load with `error`, as FreeType's checks do. */
function readingGlyph<T>(error: string, read: () => T): T {
  try {
    return read();
  } catch (cause) {
    if (cause instanceof ReadPastEndError) throw new GlyphLoadError(error);
    throw cause;
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

const EMPTY_GLYPH_HEADER: GlyphHeader = Object.freeze({ contourCount: 0, xMin: 0, yMax: 0 });

/** `TT_Load_Glyph_Header`, which leaves `reader` on the body. A glyph of no contours sits at the origin. */
function readHeader(reader: ByteReader): GlyphHeader {
  if (reader.remaining < GLYPH_HEADER_SIZE) throw new GlyphLoadError('Invalid_Outline');
  const contourCount = reader.i16();
  const xMin = reader.i16();
  reader.seek(GLYPH_Y_MAX_OFFSET);
  const yMax = reader.i16();
  return contourCount === 0 ? EMPTY_GLYPH_HEADER : { contourCount, xMin, yMax };
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
  /** The bytes of the whole font, which each glyph's bytes are a view of. */
  bytes: Uint8Array;
  unitsPerEm: number;
  isPpemRounded: boolean;
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
    start = locaEntry(dv, locaOffset, glyphIndex, isLongLoca);
    end = glyphIndex + 1 < locationCount ? locaEntry(dv, locaOffset, glyphIndex + 1, isLongLoca) : start;
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
function readSimpleFlags(reader: ByteReader, pointCount: number): number[] {
  const flags: number[] = [];
  while (flags.length < pointCount) {
    const flag = reader.u8();
    flags.push(flag);
    if (!(flag & SIMPLE_REPEAT)) continue;
    const repeats = reader.u8();
    if (flags.length + repeats > pointCount) throw new GlyphLoadError('Invalid_Outline');
    for (let k = 0; k < repeats; k++) flags.push(flag);
  }
  return flags;
}

/** One axis of a simple glyph: a delta per point, a byte or a word or none, summed into coordinates. */
function readSimpleAxis(
  reader: ByteReader,
  flags: readonly number[],
  masks: { short: number; sameOrPositive: number }
): number[] {
  let value = 0;
  return flags.map((flag) => {
    if (flag & masks.short) {
      const magnitude = reader.u8();
      value += flag & masks.sameOrPositive ? magnitude : -magnitude;
    } else if (!(flag & masks.sameOrPositive)) value += reader.i16();
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

function readSimpleGlyph(reader: ByteReader, contourCount: number): SimpleGlyph {
  if (contourCount >= MAX_SIMPLE_CONTOURS) throw new GlyphLoadError('Invalid_Outline');
  const contourEnds: number[] = [];
  for (let contour = 0, last = -1; contour < contourCount; contour++) {
    const end = reader.u16();
    if (end <= last) throw new GlyphLoadError('Invalid_Outline');
    contourEnds.push((last = end));
  }
  const pointCount = contourEnds[contourCount - 1]! + 1;
  const instructionCount = reader.u16();
  if (instructionCount > reader.remaining) throw new GlyphLoadError('Too_Many_Hints');
  const instructions = reader.take(instructionCount);
  const flags = readSimpleFlags(reader, pointCount);
  const x = readSimpleAxis(reader, flags, {
    short: SIMPLE_X_SHORT,
    sameOrPositive: SIMPLE_X_SAME_OR_POSITIVE,
  });
  const y = readSimpleAxis(reader, flags, {
    short: SIMPLE_Y_SHORT,
    sameOrPositive: SIMPLE_Y_SAME_OR_POSITIVE,
  });
  return { x, y, tags: flags.map((flag) => flag & SIMPLE_ON_CURVE), contourEnds, instructions };
}

/** A component's matrix, or null for the identity. */
function readComponentMatrix(reader: ByteReader, flags: number): Matrix2x2 | null {
  const entry = () => reader.i16() * F2DOT14_TO_16_16;
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
function readComponentArguments(reader: ByteReader, flags: number): [number, number] {
  const isOffset = (flags & COMPONENT_ARGS_ARE_XY_VALUES) !== 0;
  const read =
    flags & COMPONENT_ARGS_ARE_WORDS
      ? () => (isOffset ? reader.i16() : reader.u16())
      : () => (isOffset ? reader.i8() : reader.u8());
  return [read(), read()];
}

/**
 * `TT_Load_Composite_Glyph`: the components after the header, and the offset in the glyph's bytes
 * after them, where the composite's instructions start.
 */
function readComponents(
  reader: ByteReader,
  glyphCount: number
): { components: Component[]; instructionsAt: number } {
  const components: Component[] = [];
  let flags: number;
  do {
    flags = reader.u16();
    const glyphIndex = reader.u16();
    if (glyphIndex >= glyphCount) throw new GlyphLoadError('Invalid_Composite');
    const args = readComponentArguments(reader, flags);
    components.push({ flags, glyphIndex, arguments: args, matrix: readComponentMatrix(reader, flags) });
  } while (flags & COMPONENT_MORE);
  return { components, instructionsAt: reader.position };
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
    private readonly hinter: GlyphLoadHinter | null,
    /** The variable font's instance, or null for the default instance, which `IS_DEFAULT_INSTANCE` takes. */
    private readonly instance: FontInstance | null,
    /** `FT_LOAD_NO_SCALE`: the auto-hinter's load. A scale of 1.0 alone does not say so, as 2048 units at 32 px scale by 1.0. */
    private readonly isUnscaled: boolean
  ) {}

  /** `load_truetype_glyph`: appends the glyph's points, or throws the error that fails the load. */
  load(glyphIndex: number, depth: number): void {
    if (depth > MAX_COMPOSITE_DEPTH) throw new GlyphLoadError('Invalid_Composite');
    if (glyphIndex >= this.font.glyphCount) throw new GlyphLoadError('Invalid_Glyph_Index');
    const { offset, length } = glyphLocation(this.font, glyphIndex);
    const start = this.font.glyfOffset + offset;
    // `subarray` cuts a glyph that runs past the font short, so its read fails the load.
    const reader = ByteReader.bigEndian(this.font.bytes.subarray(start, start + length));
    const header = length === 0 ? EMPTY_GLYPH_HEADER : readHeader(reader);
    this.phantoms = phantomPoints(header, this.metricsOf(glyphIndex, header.yMax));
    if (header.contourCount === 0) {
      this.phantoms = this.scaled(this.variedPhantoms(glyphIndex));
      return;
    }
    if (header.contourCount > 0)
      this.loadSimple(
        glyphIndex,
        readingGlyph('Invalid_Outline', () => readSimpleGlyph(reader, header.contourCount))
      );
    else this.loadComposite(glyphIndex, depth, reader, start, length);
  }

  /** `tt_get_metrics`: the glyph's metrics, its advances adjusted by `HVAR` and `VVAR` at the instance. */
  private metricsOf(glyphIndex: number, yMax: number): GlyphMetrics {
    const metrics = this.font.metricsOf(glyphIndex, yMax);
    return this.instance ? metricsAtInstance(metrics, this.instance, glyphIndex) : metrics;
  }

  /** `TT_Vary_Apply_Glyph_Deltas` on the glyph's points, which `points` gives in font units. */
  private variedPoints(glyphIndex: number, points: GlyphPoints): VariedPoints {
    const { glyphVariations, normalized, adjustedAdvances } = this.instance!;
    return variedGlyphPoints(glyphVariations, normalized, glyphIndex, points, adjustedAdvances);
  }

  /** The phantom points of a glyph with no contour, moved by the instance's deltas, in whole font units. */
  private variedPhantoms(glyphIndex: number): PhantomPoints {
    if (!this.instance) return this.phantoms;
    const { x, y } = this.variedPoints(glyphIndex, { ...this.phantoms, contourEnds: [] });
    return { x, y };
  }

  private scaled({ x, y }: PhantomPoints): PhantomPoints {
    return {
      x: x.map((value) => ftMulFix(value, this.scale)),
      y: y.map((value) => ftMulFix(value, this.scale)),
    };
  }

  /** `TT_Process_Simple_Glyph`: scales the glyph, hints it, and appends it with its contours renumbered. */
  private loadSimple(glyphIndex: number, glyph: SimpleGlyph): void {
    const zone = this.instance ? this.variedSimpleZone(glyphIndex, glyph) : this.simpleZone(glyph);
    this.phantoms = this.instance ? this.variedLoaderPhantoms(zone) : zonePhantoms(zone);
    if (this.hinter) this.hint(zone, glyph.instructions, false);
    this.append(zone, glyph.contourEnds);
  }

  /** The zone of a simple glyph and its phantom points, scaled, and unscaled for the instructions. */
  private simpleZone({ x, y, tags, contourEnds }: SimpleGlyph): GlyphZone {
    const pointCount = x.length;
    const zone = newGlyphZone(pointCount + PHANTOM_POINT_COUNT, contourEnds, 0);
    for (let point = 0; point < pointCount; point++) this.place(zone, point, x[point]!, y[point]!);
    for (let phantom = 0; phantom < PHANTOM_POINT_COUNT; phantom++)
      this.place(zone, pointCount + phantom, this.phantoms.x[phantom]!, this.phantoms.y[phantom]!);
    zone.tags.set(tags);
    return zone;
  }

  /**
   * The zone of a simple glyph at the instance (`TT_Process_Simple_Glyph`): the interpreter's unscaled points
   * are the whole font units the deltas leave, and the scaled ones come from the deltas in 26.6, rounded once.
   */
  private variedSimpleZone(glyphIndex: number, { x, y, tags, contourEnds }: SimpleGlyph): GlyphZone {
    const varied = this.variedPoints(glyphIndex, {
      x: [...x, ...this.phantoms.x],
      y: [...y, ...this.phantoms.y],
      contourEnds,
    });
    const zone = newGlyphZone(varied.x.length, contourEnds, 0);
    const scaleToPixels = (unrounded: number): number =>
      Math.floor((ftMulFix(unrounded, this.scale) + 32) / 64);
    for (let point = 0; point < varied.x.length; point++) {
      zone.orusX[point] = varied.x[point]!;
      zone.orusY[point] = varied.y[point]!;
      // An unscaled load (`FT_LOAD_NO_SCALE`) keeps the whole font units the deltas leave.
      zone.curX[point] = this.isUnscaled ? varied.x[point]! : scaleToPixels(varied.unroundedX[point]!);
      zone.curY[point] = this.isUnscaled ? varied.y[point]! : scaleToPixels(varied.unroundedY[point]!);
    }
    zone.tags.set(tags);
    return zone;
  }

  /**
   * The phantom points the loader keeps once a varied glyph is scaled: the zone's, except that an
   * advance an `HVAR` or `VVAR` table adjusts is scaled from its font units when the glyph is hinted.
   */
  private variedLoaderPhantoms(zone: GlyphZone): PhantomPoints {
    const { x, y } = zonePhantoms(zone);
    if (!this.hinter) return { x, y };
    const { horizontal, vertical } = this.instance!.adjustedAdvances;
    const scaled = (value: number): number => ftMulFix(value, this.scale);
    if (horizontal) [x[0], x[1]] = [scaled(this.phantoms.x[0]!), scaled(this.phantoms.x[1]!)];
    if (vertical)
      for (const point of [2, 3])
        [x[point], y[point]] = [scaled(this.phantoms.x[point]!), scaled(this.phantoms.y[point]!)];
    return { x, y };
  }

  /** Puts `point` of `zone` at `(x, y)` in font units, and at its scaled place. */
  private place(zone: GlyphZone, point: number, x: number, y: number): void {
    zone.orusX[point] = x;
    zone.orusY[point] = y;
    zone.curX[point] = ftMulFix(x, this.scale);
    zone.curY[point] = ftMulFix(y, this.scale);
  }

  /** `FT_GlyphLoader_Add`: the zone's points after those loaded, its contours numbered in the outline. */
  private append(zone: GlyphZone, contourEnds: readonly number[]): void {
    const firstPoint = this.x.length;
    for (let point = 0; point < zone.pointCount - PHANTOM_POINT_COUNT; point++) {
      this.x.push(zone.curX[point]!);
      this.y.push(zone.curY[point]!);
      this.tags.push(zone.tags[point]!);
    }
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
  private loadComposite(
    glyphIndex: number,
    depth: number,
    reader: ByteReader,
    start: number,
    byteLength: number
  ): void {
    this.composites.length = depth;
    if (this.composites.includes(glyphIndex)) throw new GlyphLoadError('Invalid_Composite');
    this.composites[depth] = glyphIndex;

    const { components, instructionsAt } = readingGlyph('Invalid_Composite', () =>
      readComponents(reader, this.font.glyphCount)
    );
    if (this.instance) this.varyComponents(glyphIndex, components);
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
      this.hintComposite(firstPoint, firstContour, start + instructionsAt, byteLength);
  }

  /**
   * The deltas of a composite: each component's offset, which `gvar` moves as a point of its own, and
   * the phantom points, in whole font units (`load_truetype_glyph`, the composite branch).
   */
  private varyComponents(glyphIndex: number, components: Component[]): void {
    const { x, y } = this.variedPoints(glyphIndex, {
      x: [...components.map(({ arguments: [offset] }) => offset), ...this.phantoms.x],
      y: [...components.map(({ arguments: [, offset] }) => offset), ...this.phantoms.y],
      contourEnds: components.map((_, index) => index),
    });
    components.forEach((component, index) => {
      if (component.flags & COMPONENT_ARGS_ARE_XY_VALUES)
        component.arguments = [toInt16(x[index]!), toInt16(y[index]!)];
    });
    this.phantoms = { x: x.slice(components.length), y: y.slice(components.length) };
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
    // A view of the font, which the interpreter only reads. One past the buffer throws a `RangeError`.
    const instructions = new Uint8Array(dv.buffer, dv.byteOffset + instructionsAt + 2, instructionCount);
    const zone = this.compositeZone(firstPoint, firstContour);
    this.hint(zone, instructions, true);
    for (let point = firstPoint; point < this.x.length; point++) {
      this.x[point] = zone.curX[point - firstPoint]!;
      this.y[point] = zone.curY[point - firstPoint]!;
      this.tags[point] = zone.tags[point - firstPoint]!;
    }
  }

  /** `tt_prepare_zone`: the points from `firstPoint`, untouched, then the composite's phantom points. */
  private compositeZone(firstPoint: number, firstContour: number): GlyphZone {
    const pointCount = this.x.length - firstPoint;
    const zone = newGlyphZone(
      pointCount + PHANTOM_POINT_COUNT,
      this.contourEnds.slice(firstContour),
      firstPoint
    );
    for (let point = 0; point < pointCount; point++) {
      zone.curX[point] = this.x[firstPoint + point]!;
      zone.curY[point] = this.y[firstPoint + point]!;
      zone.tags[point] = this.tags[firstPoint + point]! & ~TAG_TOUCH_BOTH;
    }
    zone.curX.set(this.phantoms.x, pointCount);
    zone.curY.set(this.phantoms.y, pointCount);
    return zone;
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

/**
 * The tables of a font's `glyf` outlines, or null for a font without them, with a `head` or `maxp`
 * that does not fit, or with no units per em.
 */
function glyfFont(sfnt: SfntFile): GlyfFont | null {
  const { dv, tables } = sfnt;
  const head = tables.get('head');
  const glyf = tables.get('glyf');
  const loca = tables.get('loca');
  const glyphCount = readGlyphCount(sfnt);
  if (!head || !glyf || !loca || glyphCount === null || !tableFits(dv, head, HEAD_TABLE_MIN_LENGTH))
    return null;
  const unitsPerEm = readUnitsPerEm(dv, head);
  if (unitsPerEm === 0) return null;
  const isLongLoca = readIndexToLocFormat(dv, head) === LONG_LOCA_FORMAT;
  return {
    dv,
    bytes: new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength),
    unitsPerEm,
    isPpemRounded: readHeadIsPpemRounded(sfnt),
    glyfOffset: glyf.offset,
    glyfLength: glyf.length,
    locaOffset: loca.offset,
    locationCount: Math.floor(loca.length / (isLongLoca ? 4 : 2)),
    isLongLoca,
    glyphCount,
    metricsOf: glyphMetricsReader(sfnt),
  };
}

/**
 * The glyph-outline reader of a font's `glyf` outlines, hinted by `hinting` when it is not null, or
 * null for a font with no `glyf` or `loca` table, or a `head` or `maxp` that does not fit. A glyph
 * that FreeType fails to load, and one of no points, has no outline.
 */
export function glyphOutlineReader(sfnt: SfntFile, hinting: GlyphHinting | null): GlyphOutlineReader | null {
  const font = glyfFont(sfnt);
  if (!font) return null;
  return (glyphIndex, fontSizePx, instance = null) => {
    const { scale, ppem } = freeTypeTrueTypeSize(font.unitsPerEm, fontSizePx, font.isPpemRounded);
    const hinter = hinting ? hinting.beginLoad(ppem, scale, instance) : null;
    if (hinter === 'failed') return null;
    const load = loadedGlyph(font, glyphIndex, scale, hinter, instance, false);
    return load && load.x.length > 0 ? load.outline() : null;
  };
}

/** The glyph loaded at `scale`, or null when FreeType fails to load it. */
function loadedGlyph(
  font: GlyfFont,
  glyphIndex: number,
  scale: number,
  hinter: GlyphLoadHinter | null,
  instance: FontInstance | null,
  isUnscaled: boolean
): GlyphLoad | null {
  const load = new GlyphLoad(font, scale, hinter, instance, isUnscaled);
  try {
    load.load(glyphIndex, 0);
  } catch (error) {
    if (!(error instanceof GlyphLoadError || error instanceof InvalidTupleVariationsError)) throw error;
    return null;
  }
  return load;
}

/**
 * The `glyf` outlines as the auto-hinter loads them, unhinted in design units, or null for a font without them.
 * `instance` is the variable font's instance, or null for the default one.
 */
export function unscaledGlyfOutlines(sfnt: SfntFile, instance: FontInstance | null): UnscaledOutlines | null {
  const font = glyfFont(sfnt);
  if (!font) return null;
  return {
    unitsPerEm: font.unitsPerEm,
    isPpemRounded: font.isPpemRounded,
    glyphCount: font.glyphCount,
    unscaledGlyph: (glyphIndex) =>
      loadedGlyph(font, glyphIndex, FIXED_16_16_ONE, null, instance, true)?.outline() ?? null,
  };
}

/**
 * `FT_Load_Glyph` with `FT_LOAD_NO_HINTING | FT_LOAD_ADVANCE_ONLY`, as `ft_load_advances` runs it for a
 * variable font with no `HVAR`: the advance in 26.6 at `fontSizePx`, from the phantom points that
 * `gvar` moves. It is null for a glyph that fails to load, and for a font without `glyf`.
 */
export function glyfAdvanceReader(
  sfnt: SfntFile
): ((glyphIndex: number, fontSizePx: number, instance: FontInstance) => number | null) | null {
  const font = glyfFont(sfnt);
  if (!font) return null;
  return (glyphIndex, fontSizePx, instance) => {
    const { scale } = freeTypeTrueTypeSize(font.unitsPerEm, fontSizePx, font.isPpemRounded);
    const load = loadedGlyph(font, glyphIndex, scale, null, instance, false);
    return load && load.phantoms.x[1]! - load.phantoms.x[0]!;
  };
}

/**
 * The `hmtx` bearing and the lowest point of each glyph with a contour, as the header-only load of an
 * `sbix` glyph reads them (`ttgload.c:2412-2443`): null for a glyph with no contour, a composite one,
 * and a font without `glyf`.
 */
export function contourBoxReader(sfnt: SfntFile): ((glyphIndex: number) => ContourBox | null) | null {
  const font = glyfFont(sfnt);
  if (!font) return null;
  return (glyphIndex) => {
    const { offset, length } = glyphLocation(font, glyphIndex);
    if (length < GLYPH_HEADER_SIZE) return null;
    const at = font.glyfOffset + offset;
    if (at + GLYPH_HEADER_SIZE > font.dv.byteLength || font.dv.getInt16(at) <= 0) return null;
    return {
      leftBearing: font.metricsOf(glyphIndex, 0).horizontal.bearing,
      yMin: font.dv.getInt16(at + GLYPH_Y_MIN_OFFSET),
    };
  };
}
