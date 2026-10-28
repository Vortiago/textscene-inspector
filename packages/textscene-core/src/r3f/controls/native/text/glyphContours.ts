/**
 * The glyph outline as Godot's text server hands it to TextMesh (`font_get_glyph_contours`), and
 * the conversion into it from the 26.6 fixed-point points a FreeType loader leaves in a glyph slot.
 * The `glyf` reader (`sfntGlyf.ts`) and the CFF reader (`sfntCff.ts`) both end here.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Vector2 } from '../../../../godot/math/vector';
import { ContourPointTag } from '../../../../godot/text/textServerEnums';
import { ftMulFix } from './fontMetrics';

/** `ContourPointTag`: ON, or a conic or cubic control point. */
export type ContourTag = (typeof ContourPointTag)[keyof typeof ContourPointTag];

/** One outline point, in px from the glyph origin with y down, as `font_get_glyph_contours` returns it. */
export interface ContourPoint {
  x: number;
  y: number;
  tag: ContourTag;
}

/** What `TextServer::font_get_glyph_contours` returns for one glyph (`text_server_adv.cpp:3597-3652`). */
export interface GlyphContours {
  points: readonly ContourPoint[];
  /** The index of the last point of each contour. */
  contourEnds: readonly number[];
  /** `FT_Outline_Get_Orientation` is `FT_ORIENTATION_FILL_RIGHT`: the outer contours wind clockwise. */
  isFillRight: boolean;
}

/**
 * The contours of a glyph at `fontSizePx`, grown by `embolden` as `FT_Outline_Embolden` does, or null
 * for a glyph with no outline.
 */
export type GlyphContourReader = (
  glyphIndex: number,
  fontSizePx: number,
  embolden?: number
) => GlyphContours | null;

/** A glyph's points as FreeType holds them: 26.6 fixed point, y up. */
export interface ScaledOutline {
  x: number[];
  y: number[];
  tags: ContourTag[];
  contourEnds: number[];
}

/** The entries `[xx, xy, yx, yy]` of a 2 x 2 matrix, 16.16. */
export type Matrix2x2 = readonly [number, number, number, number];

/** `FT_Vector_Transform` of every point of `outline` by `matrix`. */
export function transformOutline(outline: ScaledOutline, [xx, xy, yx, yy]: Matrix2x2): void {
  for (let i = 0; i < outline.x.length; i++) {
    const x = outline.x[i]!;
    const y = outline.y[i]!;
    outline.x[i] = ftMulFix(x, xx) + ftMulFix(y, xy);
    outline.y[i] = ftMulFix(x, yx) + ftMulFix(y, yy);
  }
}

const FIXED_26_6 = 64;

/** `FT_Outline_Get_Orientation` rejects an outline that reaches beyond 2^24 in 26.6 (`ftoutln.c`). */
const LARGEST_ORIENTED_COORDINATE = 0x1000000;

/** The bits an area product may take, so that 32 bits suffice for it in FreeType (`ftoutln.c`). */
const AREA_COORDINATE_BITS = 14;

type OutlineOrientation = 'fillRight' | 'fillLeft' | 'none';

/** `FT_MSB`: the index of the highest set bit of `value`. */
export const highestBit = (value: number): number => 31 - Math.clz32(value);

/** The point halfway between `a` and `b`, where two control points in a row meet. */
export function midpoint(a: Vector2, b: Vector2): Vector2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** The shift that brings a coordinate range of `extent` into `AREA_COORDINATE_BITS` bits. */
const areaShift = (extent: number): number => Math.max(highestBit(extent) - AREA_COORDINATE_BITS, 0);

/** The least and the greatest of `values`, which spreading into `Math.min` cannot take for a long outline. */
function extent(values: readonly number[]): [number, number] {
  let least = Infinity;
  let greatest = -Infinity;
  for (const value of values) {
    least = Math.min(least, value);
    greatest = Math.max(greatest, value);
  }
  return [least, greatest];
}

/**
 * `FT_Outline_Get_Orientation` (`ftoutln.c`): the sign of the area the control polygon spans over
 * every contour, on coordinates shifted to fit. A collapsed or oversized outline has none.
 */
export function outlineOrientation(outline: ScaledOutline): OutlineOrientation {
  // An empty outline is fill right, as in FreeType.
  if (outline.x.length === 0) return 'fillRight';
  const [xMin, xMax] = extent(outline.x);
  const [yMin, yMax] = extent(outline.y);
  if (xMin === xMax || yMin === yMax) return 'none';
  if (Math.max(-xMin, -yMin, xMax, yMax) > LARGEST_ORIENTED_COORDINATE) return 'none';

  const xShift = areaShift(Math.max(Math.abs(xMax), Math.abs(xMin)));
  const yShift = areaShift(yMax - yMin);
  let area = 0;
  let first = 0;
  for (const last of outline.contourEnds) {
    let previous = last;
    for (let i = first; i <= last; i++) {
      area +=
        ((outline.y[i]! >> yShift) - (outline.y[previous]! >> yShift)) *
        ((outline.x[i]! >> xShift) + (outline.x[previous]! >> xShift));
      previous = i;
    }
    first = last + 1;
  }
  if (area === 0) return 'none';
  return area < 0 ? 'fillRight' : 'fillLeft';
}

/** The outline in px with y down, as `font_get_glyph_contours` returns it (`text_server_adv.cpp:3631-3641`). */
export function scaledOutlineContours(outline: ScaledOutline): GlyphContours {
  const points = outline.x.map((x, i): ContourPoint => ({
    x: x / FIXED_26_6,
    y: -outline.y[i]! / FIXED_26_6,
    tag: outline.tags[i]!,
  }));
  return {
    points,
    contourEnds: outline.contourEnds,
    isFillRight: outlineOrientation(outline) === 'fillRight',
  };
}
