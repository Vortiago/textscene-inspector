/**
 * The Godot code that turns a shaped run into quads, and the rules each one keeps. Godot has two:
 * `'canvasItem'` is `font_draw_glyph` (`text_server_adv.cpp:4072-4108`), and `'label3D'` is
 * `Label3D::_generate_glyph_surfaces` (`label_3d.cpp:333-360`). A painter reads the rules and never
 * compares the drawer.
 */
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
}

export const GLYPH_DRAWER_RULES: Readonly<Record<GlyphDrawer, GlyphDrawerRules>> = {
  canvasItem: { roundsPen: true, maxSkippedRectPx: 0, drawsHexCodeBoxes: true, multipliesInLinear: false },
  label3D: { roundsPen: false, maxSkippedRectPx: 2, drawsHexCodeBoxes: false, multipliesInLinear: true },
};

/** Whether `drawer` draws a glyph whose rectangle in its page is `width` by `height` px. */
export function drawsGlyphRect(drawer: GlyphDrawer, width: number, height: number): boolean {
  const { maxSkippedRectPx } = GLYPH_DRAWER_RULES[drawer];
  return width > maxSkippedRectPx && height > maxSkippedRectPx;
}
