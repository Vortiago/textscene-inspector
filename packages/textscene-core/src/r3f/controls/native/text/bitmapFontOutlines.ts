/**
 * The outlines of a BMFont: none. `font_get_glyph_contours` fails on a font with
 * no FreeType face (`modules/text_server_adv/text_server_adv.cpp:3613`), so a glyph the font has
 * draws nothing, and a character it lacks keeps its hex-code box (`primitive_meshes.cpp:3547-3577`).
 */

import type { BitmapFont } from '../../../../resources/fonts/font/types';
import { perObject } from '../../../../utils/perObject';
import type { SfntOutlines } from './sfntOutlines';

/** One adapter per font, so the glyph mesh cache and the build key keep their hits. */
export const bitmapFontOutlines = perObject((bitmap: BitmapFont): SfntOutlines => ({
  // The glyph index is the codepoint, as `_load_bitmap_font` keys each glyph (`font.cpp:2020`).
  glyphIndex: (codePoint) => (bitmap.glyphs.has(codePoint) ? codePoint : 0),
  glyphContours: () => null,
}));
