/**
 * The Godot code that turns a shaped run into quads, which decides the rules a painter follows.
 *
 * - `'canvasItem'` is `font_draw_glyph` (`text_server_adv.cpp:4072-4108`): it rounds each pen to
 *   the canvas pixel grid, `draw_hex_code_box` draws a character no font has, and the modulate
 *   multiplies a glyph texture in sRGB.
 * - `'label3D'` is `Label3D::_generate_glyph_surfaces` (`label_3d.cpp:333-360`): its mesh keeps the
 *   pen, and it skips a glyph whose UV rect is 2 px or less in either direction. A hex-code box has
 *   no UV rect, so a Label3D draws none. Its material decodes the glyph texture (`source_color`,
 *   `material.cpp:969`) and the modulate (`material.cpp:1218`), so it multiplies in linear.
 */
export type GlyphDrawer = 'canvasItem' | 'label3D';

/** `label_3d.cpp:357`: a glyph whose UV rect is this size or less in either direction draws nothing. */
const LABEL3D_MAX_SKIPPED_UV_PX = 2;

/** Whether `drawer` draws a glyph whose rectangle in its page is `width` by `height` px. */
export function drawsGlyphRect(drawer: GlyphDrawer, width: number, height: number): boolean {
  if (drawer === 'label3D') return width > LABEL3D_MAX_SKIPPED_UV_PX && height > LABEL3D_MAX_SKIPPED_UV_PX;
  return width > 0 && height > 0;
}
