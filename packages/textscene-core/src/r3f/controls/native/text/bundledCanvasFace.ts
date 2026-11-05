/**
 * The canvas face that draws a run shaped in the bundled atlas face, where only the canvas painter
 * is faithful (ADR-0040): the bundled canvas face, varied as the atlas run is. It imports the font
 * bytes, so only a lazy chunk imports it.
 */
import type { FontResource } from '../../../../resources/fonts/font/types';
import { peekBundledCanvasFontMetrics } from './bundledFontLoader';
import { withOutlines, withVariation, type FontMetrics } from './fontMetrics';
import type { CanvasFontMetrics } from './runtimeFontMetrics';
import { peekGlyphOutlines } from './sceneFontOutlines';

/** `undefined` while the bundled face registers, or while the glyph outlines a variation needs load. */
export function bundledCanvasFace(
  font: FontResource | null | undefined,
  atlas: FontMetrics
): CanvasFontMetrics | undefined {
  const bundled = peekBundledCanvasFontMetrics();
  if (!bundled) return undefined;
  const outlines = peekGlyphOutlines(font, bundled, atlas);
  if (outlines === undefined) return undefined;
  const varied = withVariation(bundled, atlas);
  return outlines ? withOutlines(varied, outlines) : varied;
}
