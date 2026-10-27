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

import { ContourPointTag } from '../../../../godot/text/textServerEnums';

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

/** The contours of a glyph at `fontSizePx`, or null for a glyph with no outline. */
export type GlyphContourReader = (glyphIndex: number, fontSizePx: number) => GlyphContours | null;

/** A glyph's points as FreeType holds them: 26.6 fixed point, y up. */
export interface ScaledOutline {
  x: number[];
  y: number[];
  tags: (typeof ContourPointTag)[keyof typeof ContourPointTag][];
  contourEnds: number[];
}

const FIXED_26_6 = 64;

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

/** The outline in px with y down, as `font_get_glyph_contours` returns it (`text_server_adv.cpp:3631-3641`). */
export function scaledOutlineContours(outline: ScaledOutline): GlyphContours {
  const points = outline.x.map((x, i): ContourPoint => ({
    x: x / FIXED_26_6,
    y: -outline.y[i]! / FIXED_26_6,
    tag: outline.tags[i]!,
  }));
  return { points, contourEnds: outline.contourEnds, isFillRight: isFillRight(outline) };
}
