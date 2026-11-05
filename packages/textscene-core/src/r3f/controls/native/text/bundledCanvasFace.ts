/**
 * The bundled font as the canvas painter draws it: a bundled atlas face turned into the bundled
 * canvas face, for the embolden and the outline ring the atlas field cannot carry (ADR-0040).
 */
import { peekBundledCanvasFontMetrics } from './bundledFontLoader';
import { withVariation, type FontMetrics } from './fontMetrics';
import type { CanvasFontMetrics } from './runtimeFontMetrics';
import { peekGlyphOutlines } from './sceneFontOutlines';

/**
 * The bundled canvas face carrying the variation of `atlasFace`, with the outlines FreeType
 * emboldens and shears. Undefined while the face or its outlines load, and null when the face cannot register.
 */
export function peekBundledCanvasFace(atlasFace: FontMetrics): CanvasFontMetrics | null | undefined {
  const bundled = peekBundledCanvasFontMetrics();
  if (!bundled) return bundled;
  const outlines = peekGlyphOutlines(null, bundled);
  if (outlines === undefined) return undefined;
  // Null is a font this reader cannot open, which draws its text.
  return withVariation(bundled, {
    embolden: atlasFace.embolden,
    skew: atlasFace.skew,
    opentype: atlasFace.opentype,
    outlines: outlines ?? undefined,
  });
}
