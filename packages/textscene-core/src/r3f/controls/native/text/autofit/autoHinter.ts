/**
 * FreeType's auto-hinter as Godot loads a glyph's contours through it (`afloader.c`): the style's
 * hinter scales to the size, hints the glyph in font units, and the outline moves by the hinted
 * left side bearing's rounding. Godot loads for the normal target, so no stem darkens.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 2003-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { GlyphOutlineReader } from '../glyphContours';
import { freeTypeTrueTypeSize, pixRound } from '../fontMetrics';
import { glyfSize } from '../sfntGlyf';
import type { SfntFile } from '../sfntTables';
import type { AutofitFace } from './afFace';
import { AutofitGlobals } from './afGlobals';
import { Dimension, ScalerFlag, type GlyphHints } from './afHints';
import { sfntAutofitFace } from './sfntAutofitFace';

/**
 * `af_loader_load_glyph`'s left phantom point in the normal mode: the first horizontal edge's
 * shift, rounded, less a pixel when the rounding passes the edge. A glyph of one edge or none, or
 * of a style that leaves the advance unhinted, keeps its origin.
 */
function hintedLeftBearingShift(hints: GlyphHints): number {
  const { edges } = hints.axis[Dimension.HORZ];
  if (edges.length <= 1 || hints.scalerFlags & ScalerFlag.NO_ADVANCE) return pixRound(hints.xDelta);
  const { opos: oldLsb, pos: newLsb } = edges[0]!;
  const unhinted = newLsb - oldLsb - (oldLsb < 24 ? 8 : 0);
  const shift = pixRound(unhinted);
  return shift >= newLsb && oldLsb > 0 ? shift - 64 : shift;
}

/** The auto-hinted outline reader of `face`, whose sizes round their ppem as `isPpemRounded` says. */
function autoHintedOutlineReader(face: AutofitFace, isPpemRounded: boolean): GlyphOutlineReader {
  const globals = new AutofitGlobals(face);
  return (glyphIndex, fontSizePx) => {
    if (glyphIndex >= face.glyphCount) return null;
    const { scale, ppem } = freeTypeTrueTypeSize(face.unitsPerEm, fontSizePx, isPpemRounded);
    const hinter = globals.hinterOf(glyphIndex);
    hinter.scale({ xScale: scale, yScale: scale, xDelta: 0, yDelta: 0, ppem });
    hinter.initHints(globals.hints);
    const outline = face.unscaledGlyph(glyphIndex);
    if (!outline || outline.x.length === 0) return null;
    hinter.apply(glyphIndex, globals.hints, outline);
    const shift = hintedLeftBearingShift(globals.hints);
    if (shift) outline.x = outline.x.map((x) => x - shift);
    return outline;
  };
}

/**
 * The auto-hinted outline reader of a font's `glyf` outlines, or null for a font without them or
 * without a `cmap`.
 */
export function autoHintedGlyfReader(sfnt: SfntFile): GlyphOutlineReader | null {
  const face = sfntAutofitFace(sfnt);
  const size = glyfSize(sfnt);
  return face && size && autoHintedOutlineReader(face, size.isPpemRounded);
}
