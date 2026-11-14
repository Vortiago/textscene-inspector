/**
 * The interface of the painters of a canvas text run. `canvasTextPainter.ts` chooses one for the
 * run, once, by its face: `outlineGlyphPainter.ts` draws each glyph from its contours,
 * `browserTextPainter.ts` draws each glyph as browser text, and `blankGlyphPainter.ts` draws none.
 */
import type { Rect2 } from '../../../../godot/math/rect2';
import type { RunColours } from './colour/colourGlyphRaster';
import type { CanvasFontMetrics } from './runtimeFontMetrics';
import type { CanvasTextCanvasLayout } from './canvasTextPainter';
import type { GlyphPlacement } from './textLayout';

/** How far the ink of a glyph reaches left of its pen and right of it, px, its pen box included. */
export interface GlyphReach {
  leftPx: number;
  rightPx: number;
}

/** The raster a run paints into, and how its glyphs draw there. */
export interface RasterFrame {
  readonly metrics: CanvasFontMetrics;
  readonly fontSizePx: number;
  readonly skew: number;
  readonly canvasLayout: CanvasTextCanvasLayout;
  /** Whether the glyphs snap to whole item pixels (`snapsGlyphsToItemPixels`). */
  readonly snapsGlyphs: boolean;
  /** Whether the drawer rounds the pen, as a canvas item does and Label3D does not (`glyphDrawer.ts`). */
  readonly roundsPen: boolean;
  /** A positive width paints the outline ring instead of the fill. */
  readonly strokeWidthPx: number;
}

/** A glyph of the layout at its pen and baseline in the raster. */
export interface PlacedGlyph {
  readonly placement: GlyphPlacement;
  readonly penX: number;
  readonly baselineY: number;
}

export interface GlyphPainter {
  /**
   * Reads how far the ink of each glyph reaches at `skew`, from what the paint draws for it, on a
   * line whose ascent is `lineAscentPx`.
   */
  reachReader(skew: number, lineAscentPx: number): (glyph: GlyphPlacement) => GlyphReach;
  /** The raster of `glyphs` in `colours`. Null where the painter needs a 2D context and the document has none. */
  paint(glyphs: readonly PlacedGlyph[], frame: RasterFrame, colours: RunColours): ImageData | null;
  /** Reads the rectangle of the quad Godot draws for a glyph, in raster px, or null for a glyph that draws none. */
  rectReader(frame: RasterFrame): (glyph: PlacedGlyph) => Rect2 | null;
}

/**
 * Whether a placement draws a glyph of its own. A hex-code box draws as quads (`TextRunMesh`), so the
 * text the font lacks never reaches a host font.
 */
export function hasOwnGlyph(gp: GlyphPlacement): boolean {
  if (gp.char === ' ' || gp.char === '\n' || gp.char === '\r') return false;
  return gp.controlCodepoint === undefined;
}
