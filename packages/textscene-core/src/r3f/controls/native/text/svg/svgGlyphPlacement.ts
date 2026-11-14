/**
 * Where Godot's OT-SVG hook places a glyph's picture (`tvg_svg_in_ot_preset_slot`,
 * `thorvg_svg_in_ot.cpp:218-300`): the picture's own size at the ppem over the em box width, centred
 * on the advance, and raised by its height times the line over the ascender. ThorVG keeps each size
 * in float32, and the slot keeps the corner as whole pixels cut toward zero.
 */

/** The FreeType size of the face (`FT_Size_Metrics`): its ppem, and its ascender and descender in 26.6. */
export interface SvgGlyphSize {
  readonly xPpem: number;
  readonly yPpem: number;
  readonly ascender: number;
  readonly descender: number;
}

/** The size ThorVG reads from a document: its content's box, as Godot strips the view box and the size. */
export interface PictureSize {
  readonly width: number;
  readonly height: number;
}

/** The glyph's bitmap and how the picture maps onto it. */
export interface SvgGlyphPlacement {
  /** `gl_state.w` and `gl_state.h`: the size the picture draws at, in float32. */
  readonly pictureWidth: number;
  readonly pictureHeight: number;
  /** `bitmap.width` and `bitmap.rows`: the picture's size rounded up. */
  readonly width: number;
  readonly rows: number;
  /** `bitmap_left` and `bitmap_top`: the bitmap's corner from the pen, y up. */
  readonly left: number;
  readonly top: number;
}

const f32 = Math.fround;

// `+ 0` in the corner turns the -0 of `Math.trunc` into the 0 of an `FT_Int`.

/** The placement of a picture of `picture` size, or null for a picture of no area, which ThorVG cannot size. */
export function svgGlyphPlacement(
  picture: PictureSize,
  embox: { readonly x: number; readonly y: number },
  { xPpem, yPpem, ascender, descender }: SvgGlyphSize,
  horiAdvance26_6: number
): SvgGlyphPlacement | null {
  const { width: svgWidth, height: svgHeight } = picture;
  if (!(svgWidth > 0 && svgHeight > 0)) return null;
  const aspectX = svgWidth > svgHeight ? svgWidth / svgHeight : 1;
  const aspectY = svgWidth < svgHeight ? svgHeight / svgWidth : 1;
  const scale = (embox.x * aspectX) / svgWidth;
  const lineOverAscender = (ascender + descender) / ascender;
  const xSvgToOut = xPpem / embox.x / scale;
  const ySvgToOut = yPpem / embox.y / scale;
  const width = f32(embox.x * aspectX * xSvgToOut);
  const height = f32(embox.y * aspectY * ySvgToOut);
  const x = f32((horiAdvance26_6 / 64 - width) / 2);
  const y = f32(-Math.ceil(height * lineOverAscender));
  return {
    pictureWidth: width,
    pictureHeight: height,
    width: Math.ceil(width),
    rows: Math.ceil(height),
    left: Math.trunc(x) + 0,
    top: Math.trunc(-y) + 0,
  };
}
