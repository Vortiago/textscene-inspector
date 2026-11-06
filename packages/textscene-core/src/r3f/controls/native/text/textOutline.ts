/**
 * The reach of Godot's text outline: the radius FreeType's stroker takes and the width of the
 * canvas stroke that draws the same ring.
 */

/**
 * The one-sided reach of Godot's outline stroke, `outline_size * 16 / 64` px. FreeType's
 * stroker (`text_server_adv.cpp:1383-1390`, keyed at `label_3d.cpp:344-349`) gets
 * `outline_size` unscaled (`text_server_adv.h:406-414`), and `FT_Stroker_Set`
 * (`text_server_adv.cpp:1383`) takes 26.6 fixed point, so `font_size` plays no part.
 */
function outlineRadiusPx(outlineSizePx: number): number {
  return Math.trunc(outlineSizePx * 16) / 64;
}

/**
 * The canvas stroke width for that radius: a canvas stroke is centred on the
 * path, like `FT_Glyph_Stroke`'s both-borders annulus (`text_server_adv.cpp:
 * 1392`). `0` for a size of 0 or less, where Godot skips the outline pass (`label_3d.cpp:610`,
 * `button.cpp:460`). The caller checks the alpha half of that gate.
 */
export function outlineStrokeWidthPx(outlineSizePx: number): number {
  if (outlineSizePx <= 0) return 0;
  return 2 * outlineRadiusPx(outlineSizePx);
}
