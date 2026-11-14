/**
 * The painter of a face with no outlines it can read and no `FontFace`: the bundled face while its
 * outlines load, or after they fail to read. It draws no glyph, as `fillText` would paint a host
 * font for an unregistered family, and each glyph spans its pen box.
 */
import type { GlyphPainter } from './glyphPainter';

export const blankGlyphPainter: GlyphPainter = {
  reachReader: () => (glyph) => ({ leftPx: 0, rightPx: glyph.advance }),
  paint: (_glyphs, { canvasLayout }) =>
    new ImageData(canvasLayout.canvasWidthPx, canvasLayout.canvasHeightPx),
  rectReader: () => () => null,
};
