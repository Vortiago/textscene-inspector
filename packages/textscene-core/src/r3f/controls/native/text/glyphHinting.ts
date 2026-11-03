/**
 * What the TrueType glyph loader (`sfntGlyf.ts`) asks of a hinter, and the glyph zone it hands it:
 * FreeType's bytecode interpreter (`truetype/`), which TextMesh loads on demand for a font that
 * FreeType hints natively. A font with neither a font program nor a control value program of more
 * than 7 bytes goes to FreeType's auto-hinter instead (`ftobjs.c`, `FT_Load_Glyph`), whatever its
 * glyph programs hold, unless FreeType lists it as tricky (`trickyFont.ts`).
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { SfntFile } from './sfntTables';
import { isTrickyFont } from './trickyFont';

/** `FT_CURVE_TAG_TOUCH_X`: an instruction has moved the point along x. */
export const TAG_TOUCH_X = 0x08;
/** `FT_CURVE_TAG_TOUCH_Y`: an instruction has moved the point along y. */
export const TAG_TOUCH_Y = 0x10;
export const TAG_TOUCH_BOTH = TAG_TOUCH_X | TAG_TOUCH_Y;

/** The four phantom points that follow a glyph's own: left and right side bearing, top and bottom. */
export const PHANTOM_POINT_COUNT = 4;

/**
 * A glyph zone of the TrueType interpreter (`TT_GlyphZoneRec`, `tttypes.h`): the points an
 * instruction moves in 26.6, `org` before the instructions run, `cur` as they move, and `orus`
 * unscaled, each with its touch flags. A glyph's zone ends in its four phantom points. The
 * caller owns the arrays: the interpreter moves `cur` and `tags` in place.
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

/** `tt_glyphzone_new`: a zone of `pointCount` points at the origin, untouched, with `contourEnds`. */
export function newGlyphZone(
  pointCount: number,
  contourEnds: ArrayLike<number>,
  firstPoint: number
): GlyphZone {
  return {
    pointCount,
    contourCount: contourEnds.length,
    orgX: new Float64Array(pointCount),
    orgY: new Float64Array(pointCount),
    curX: new Float64Array(pointCount),
    curY: new Float64Array(pointCount),
    orusX: new Float64Array(pointCount),
    orusY: new Float64Array(pointCount),
    tags: new Uint8Array(pointCount),
    contourEnds,
    firstPoint,
  };
}

/** The hinter of one glyph load, `tt_loader_init`'s execution context. */
export interface GlyphLoadHinter {
  /**
   * Whether the v40 interpreter's backward compatibility is on, which keeps the side bearings and
   * a component's x offset unrounded. A glyph program may turn it off for the rest of the load.
   */
  readonly isBackwardCompatible: boolean;
  /**
   * `TT_Hint_Glyph`: rounds the phantom points and runs `instructions` on `zone` in place. A
   * composite's instructions see the hinted points of its components as their unscaled ones.
   * An instruction error keeps the points it has moved, as FreeType's non-pedantic mode does.
   */
  hint(zone: GlyphZone, instructions: Uint8Array, isComposite: boolean): void;
}

/** The glyph loads of one font, each at a ppem and scale. */
export interface GlyphHinting {
  /**
   * The hinter of one load at `ppem`, whose 16.16 `scale` takes font units to 26.6 pixels. Null
   * when the control value program turns hinting off, so the glyph loads unhinted. `'failed'` when
   * the font program or the control value program failed at this size, so FreeType loads no glyph.
   */
  beginLoad(ppem: number, scale: number): GlyphLoadHinter | null | 'failed';
}

/** The size of a control value program that the auto-hinter still takes over from (`ftobjs.c`). */
const LARGEST_AUTOHINTED_CONTROL_VALUE_PROGRAM = 7;

/** Whether FreeType runs the font's own TrueType hints rather than its auto-hinter. */
export function isNativelyHinted(sfnt: SfntFile): boolean {
  const fontProgramLength = sfnt.tables.get('fpgm')?.length ?? 0;
  const controlValueProgramLength = sfnt.tables.get('prep')?.length ?? 0;
  return (
    fontProgramLength > 0 ||
    controlValueProgramLength > LARGEST_AUTOHINTED_CONTROL_VALUE_PROGRAM ||
    isTrickyFont(sfnt)
  );
}
