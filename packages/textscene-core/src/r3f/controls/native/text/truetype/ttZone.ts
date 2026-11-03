/**
 * A glyph zone of the TrueType interpreter (`TT_GlyphZoneRec`, `tttypes.h`): the points an
 * instruction moves, each with its original, current and unscaled position and its touch flags.
 * A glyph's zone ends in its four phantom points; the twilight zone holds points of no glyph.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

/** `FT_CURVE_TAG_ON`: the point is on the curve. */
export const TAG_ON_CURVE = 0x01;
/** `FT_CURVE_TAG_TOUCH_X`: an instruction has moved the point along x. */
export const TAG_TOUCH_X = 0x08;
/** `FT_CURVE_TAG_TOUCH_Y`: an instruction has moved the point along y. */
export const TAG_TOUCH_Y = 0x10;
export const TAG_TOUCH_BOTH = TAG_TOUCH_X | TAG_TOUCH_Y;

/** The four phantom points that follow a glyph's own: left and right side bearing, top and bottom. */
export const PHANTOM_POINT_COUNT = 4;

/**
 * The points of a zone in 26.6, `org` before the instructions run, `cur` as they move, and `orus`
 * unscaled. The caller owns the arrays: the interpreter moves `cur` and `tags` in place.
 */
export interface GlyphZone {
  /** The points an instruction may address. The twilight zone may cap this below its arrays' length. */
  pointCount: number;
  readonly contourCount: number;
  readonly orgX: Float64Array;
  readonly orgY: Float64Array;
  readonly curX: Float64Array;
  readonly curY: Float64Array;
  readonly orusX: Float64Array;
  readonly orusY: Float64Array;
  readonly tags: Uint8Array;
  /** The last point of each contour, numbered in the whole outline the zone is a part of. */
  readonly contourEnds: ArrayLike<number>;
  /** The number in the whole outline of the zone's point 0, which `contourEnds` count from. */
  readonly firstPoint: number;
}

/** `tt_glyphzone_new`: a zone of `pointCount` points at the origin and no contours. */
export function emptyZone(pointCount: number): GlyphZone {
  return {
    pointCount,
    contourCount: 0,
    orgX: new Float64Array(pointCount),
    orgY: new Float64Array(pointCount),
    curX: new Float64Array(pointCount),
    curY: new Float64Array(pointCount),
    orusX: new Float64Array(pointCount),
    orusY: new Float64Array(pointCount),
    tags: new Uint8Array(pointCount),
    contourEnds: [],
    firstPoint: 0,
  };
}
