/**
 * The interface of the two painters of a canvas text run. `canvasTextPainter.ts` chooses one for
 * the run, once, by whether its face carries outlines: `outlineGlyphPainter.ts` draws each glyph
 * from its contours, and `browserTextPainter.ts` draws each glyph as browser text.
 */
import type { Rect2 } from '../../../../godot/math/rect2';
import type { Vector2 } from '../../../../godot/math/vector';
import type { ByteColour } from './glyphCoverage';
import type { CanvasFontMetrics } from './runtimeFontMetrics';
import type { CanvasTextCanvasLayout } from './canvasTextPainter';
import type { GlyphPlacement, TextLayoutResult } from './textLayout';

/** How far the ink of a glyph reaches left of its pen and right of it, px, its pen box included. */
export interface GlyphReach {
  leftPx: number;
  rightPx: number;
}

/** Where a raster sits against the run origin, and whether its glyphs snap to whole item pixels. */
export interface RasterFrame {
  readonly metrics: CanvasFontMetrics;
  readonly fontSizePx: number;
  readonly skew: number;
  readonly canvasLayout: CanvasTextCanvasLayout;
  readonly originPhasePx: Readonly<Vector2>;
  readonly snapsGlyphs: boolean;
}

/** A glyph of the layout at its pen and baseline in the raster. */
export interface PlacedGlyph {
  readonly placement: GlyphPlacement;
  readonly penX: number;
  readonly baselineY: number;
}

export interface GlyphPainter {
  /** Reads how far the ink of each glyph of `layout` reaches at `skew`, from what the paint draws for it. */
  reachReader(layout: TextLayoutResult, skew: number): (glyph: GlyphPlacement) => GlyphReach;
  /**
   * The raster of `glyphs` in `colour`, the outline ring for a positive `strokeWidthPx`. Null where
   * the painter needs a 2D context and the document has none.
   */
  paint(
    glyphs: readonly PlacedGlyph[],
    frame: RasterFrame,
    colour: ByteColour,
    strokeWidthPx: number
  ): ImageData | null;
  /** Reads the rectangle of the quad Godot draws for a glyph, in raster px, or null for a glyph that draws none. */
  rectReader(frame: RasterFrame, outlineRadiusPx: number): (glyph: PlacedGlyph) => Rect2 | null;
}

/**
 * Whether a placement draws a glyph of its own. A hex-code box draws as quads (`TextRunMesh`), so the
 * text the font lacks never reaches a host font.
 */
export function hasOwnGlyph(gp: GlyphPlacement): boolean {
  if (gp.char === ' ' || gp.char === '\n' || gp.char === '\r') return false;
  return gp.controlCodepoint === undefined;
}
