/**
 * FreeType's auto-hinter as Godot loads a glyph's contours through it (`afloader.c`): the style's
 * hinter scales to the size, hints the glyph in font units, and the outline moves by the hinted
 * left side bearing's rounding. No stem darkens: FreeType darkens at the light target only when
 * the face or the module asks (`afloader.c:366`), and Godot asks neither.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 2003-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { GlyphOutlineReader } from '../glyphContours';
import { freeTypeTrueTypeSize, pixRound } from '../fontMetrics';
import { unscaledCffOutlines } from '../sfntCff';
import { unscaledGlyfOutlines } from '../sfntGlyf';
import type { SfntFile } from '../sfntTables';
import type { AutofitFace, RenderMode } from './afFace';
import { AutofitGlobals, initStyleHints } from './afGlobals';
import { Dimension, ScalerFlag, type GlyphHints } from './afHints';
import { sfntAutofitFace } from './sfntAutofitFace';

/**
 * `af_loader_load_glyph`'s left phantom point (`afloader.c:422-489`): the first horizontal edge's
 * shift, rounded, less a pixel when the rounding passes the edge. A glyph of one edge or none, a
 * style that leaves the advance unhinted, and the light target keep the origin.
 */
function hintedLeftBearingShift(hints: GlyphHints, renderMode: RenderMode): number {
  const { edges } = hints.axis[Dimension.HORZ];
  const keepsOrigin =
    renderMode === 'light' || edges.length <= 1 || hints.scalerFlags & ScalerFlag.NO_ADVANCE;
  if (keepsOrigin) return pixRound(hints.xDelta);
  const { opos: oldLsb, pos: newLsb } = edges[0]!;
  const unhinted = newLsb - oldLsb - (oldLsb < 24 ? 8 : 0);
  const shift = pixRound(unhinted);
  return shift >= newLsb && oldLsb > 0 ? shift - 64 : shift;
}

function autoHintedOutlineReader(face: AutofitFace, renderMode: RenderMode): GlyphOutlineReader {
  const globals = new AutofitGlobals(face);
  return (glyphIndex, fontSizePx) => {
    if (glyphIndex >= face.glyphCount) return null;
    const { scale, ppem } = freeTypeTrueTypeSize(face.unitsPerEm, fontSizePx, face.isPpemRounded);
    const hinter = globals.hinterOf(glyphIndex);
    hinter.scale({ xScale: scale, yScale: scale, xDelta: 0, yDelta: 0, ppem, renderMode });
    initStyleHints(globals.hints, hinter);
    const outline = face.unscaledGlyph(glyphIndex);
    if (!outline || outline.x.length === 0) return null;
    hinter.apply(glyphIndex, globals.hints, outline);
    const shift = hintedLeftBearingShift(globals.hints, renderMode);
    if (shift) for (let i = 0; i < outline.x.length; i++) outline.x[i] = outline.x[i]! - shift;
    return outline;
  };
}

/**
 * The outline reader of a font's `glyf` or CFF outlines auto-hinted for `renderMode`, or null for a
 * font without them or without a `cmap`. A variable font's instance has its own globals, as FreeType's face holds
 * one instance whose glyphs the blue zones and the styles are measured on.
 */
export function autoHintedReader(sfnt: SfntFile, renderMode: RenderMode): GlyphOutlineReader | null {
  const outlines = unscaledGlyfOutlines(sfnt, null) ?? unscaledCffOutlines(sfnt);
  const face = outlines && sfntAutofitFace(sfnt, outlines);
  if (!face) return null;
  const readers = new Map<string, GlyphOutlineReader>([['', autoHintedOutlineReader(face, renderMode)]]);
  return (glyphIndex, fontSizePx, instance = null) => {
    const key = instance?.key ?? '';
    if (!readers.has(key)) {
      const instanceOutlines = unscaledGlyfOutlines(sfnt, instance);
      const instanceFace = instanceOutlines && { ...face, unscaledGlyph: instanceOutlines.unscaledGlyph };
      readers.set(key, autoHintedOutlineReader(instanceFace ?? face, renderMode));
    }
    return readers.get(key)!(glyphIndex, fontSizePx, instance);
  };
}
