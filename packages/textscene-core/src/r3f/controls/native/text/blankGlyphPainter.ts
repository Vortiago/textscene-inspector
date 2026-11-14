/**
 * The painter of a face with no outlines it can read and no `FontFace`: the bundled face while its
 * outlines load, or after they fail to read. It draws no glyph, as `fillText` would paint a host
 * font for an unregistered family, and each glyph spans its pen box.
 */
import { colourRaster } from './glyphCoverage';
import type { GlyphPainter } from './glyphPainter';

export const blankGlyphPainter: GlyphPainter = {
  reachReader: () => (glyph) => ({ leftPx: 0, rightPx: glyph.advance }),
  // Coloured as every raster is: a texel at alpha 0 keeps the tint, as `colourRaster` says.
  paint: (_glyphs, { canvasLayout }, colours) => {
    const image = new ImageData(canvasLayout.canvasWidthPx, canvasLayout.canvasHeightPx);
    colourRaster(image, colours.text);
    return image;
  },
  rectReader: () => () => null,
};
