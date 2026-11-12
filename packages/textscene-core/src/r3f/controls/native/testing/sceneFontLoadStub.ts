/**
 * A stand-in for `text/sceneFontLoad` in a test that draws a font file: happy-dom has neither
 * `FontFace` nor a 2D canvas, so every file loads as a canvas face with the advances of the bundled
 * font. A test file mocks `text/sceneFontLoad` with this module.
 */
import { OPEN_SANS_FONT_METRICS } from '../text/openSansFontMetrics';
import { createRuntimeFontMetrics, type RegisteredCanvasFontMetrics } from '../text/runtimeFontMetrics';

const advanceUnits = (ch: string): number =>
  OPEN_SANS_FONT_METRICS.getGlyphAdvanceUnits(ch) ?? OPEN_SANS_FONT_METRICS.averageAdvanceUnits;

// No glyphs of its own: the shaping of the bundled font would hand out glyph indices that the
// outlines of the loaded file do not share.
const STAND_IN_METRICS = createRuntimeFontMetrics({
  scalars: OPEN_SANS_FONT_METRICS,
  measureWidthUnits: (text) => [...text].reduce((width, ch) => width + advanceUnits(ch), 0),
  cssFontFamily: 'tscn-stand-in-scene-font',
  hasGlyph: (ch) => OPEN_SANS_FONT_METRICS.hasGlyph(ch),
});

export async function loadSceneFontMetrics(): Promise<RegisteredCanvasFontMetrics> {
  return STAND_IN_METRICS;
}
