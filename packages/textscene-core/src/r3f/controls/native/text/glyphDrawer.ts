/**
 * The Godot code that turns a shaped run into quads, and the rules each one keeps. Godot has two:
 * `'canvasItem'` is `font_draw_glyph` (`text_server_adv.cpp:4072-4108`), and `'label3D'` is
 * `Label3D::_generate_glyph_surfaces` (`label_3d.cpp:333-360`). A painter reads the rules and never
 * compares the drawer.
 */
import { isBitmapFontMetrics } from './bitmapFontMetrics';
import { fontIsScaled, type FontMetrics } from './fontMetrics';
import { isCanvasFontMetrics } from './runtimeFontMetrics';

export type GlyphDrawer = 'canvasItem' | 'label3D';

interface GlyphDrawerRules {
  /** A canvas item rounds each pen to its pixel grid (`text_server_adv.cpp:4082-4085`). A Label3D mesh keeps it. */
  roundsPen: boolean;
  /**
   * A glyph whose rectangle in its page is this size or less in either direction draws nothing.
   * Label3D skips 2 px (`label_3d.cpp:357`), and a hex-code box has no rectangle, so it draws none.
   */
  maxSkippedRectPx: number;
  /** `draw_hex_code_box` draws a character no font has (`text_server.cpp:771-812`). */
  drawsHexCodeBoxes: boolean;
  /**
   * The material decodes a glyph texture and the modulate and multiplies them in linear: Label3D's
   * `source_color` albedo and sRGB vertex colour (`material.cpp:969,1218`). A canvas item multiplies in sRGB.
   */
  multipliesInLinear: boolean;
  /**
   * The full modulate tints a colour glyph. A canvas item keeps only the alpha of the font colour for
   * one (`text_server_adv.cpp:4044-4046`). Label3D puts its modulate in every vertex colour
   * (`label_3d.cpp:428`).
   */
  tintsColourGlyphs: boolean;
}

export const GLYPH_DRAWER_RULES: Readonly<Record<GlyphDrawer, GlyphDrawerRules>> = {
  canvasItem: {
    roundsPen: true,
    maxSkippedRectPx: 0,
    drawsHexCodeBoxes: true,
    multipliesInLinear: false,
    tintsColourGlyphs: false,
  },
  label3D: {
    roundsPen: false,
    maxSkippedRectPx: 2,
    drawsHexCodeBoxes: false,
    multipliesInLinear: true,
    tintsColourGlyphs: true,
  },
};

/** Whether `drawer` draws a glyph whose rectangle in its page is `width` by `height` px. */
export function drawsGlyphRect(drawer: GlyphDrawer, width: number, height: number): boolean {
  const { maxSkippedRectPx } = GLYPH_DRAWER_RULES[drawer];
  return width > maxSkippedRectPx && height > maxSkippedRectPx;
}

/**
 * Whether `glyphDrawer` snaps the pen and baseline of a run in `metrics` at `fontSizePx` to its item
 * pixels: a canvas item does at scale 1 (`text_server_adv.cpp:4082-4084`), a Label3D mesh never does.
 */
export function snapsPen(glyphDrawer: GlyphDrawer, fontSizePx: number, metrics: FontMetrics): boolean {
  return GLYPH_DRAWER_RULES[glyphDrawer].roundsPen && isUnscaledAt(metrics, fontSizePx);
}

/**
 * Whether `metrics` draws at scale 1 at `fontSizePx`: a bitmap face at a size its scale mode draws
 * at 1, or an outline face drawn from a canvas raster at a whole size of its strike. The bundled face
 * draws off the canvas painter, which reads no pen phase, so it counts as scaled.
 */
export function isUnscaledAt(metrics: FontMetrics, fontSizePx: number): boolean {
  if (isBitmapFontMetrics(metrics)) return metrics.pxPerUnit(fontSizePx) === 1;
  if (isCanvasFontMetrics(metrics)) return !fontIsScaled(fontSizePx, metrics);
  return false;
}
