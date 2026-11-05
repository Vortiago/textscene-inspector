/**
 * The glyph outlines of a scene font as far as they have loaded, which a TextMesh extrudes: the
 * counterpart of the metrics peek in `sceneFontLoader.ts`, and it answers a settled load through
 * the same channel. A WOFF2 decompresses with Brotli and rebuilds its `glyf`, so the answer is
 * never there on the first peek. It never throws.
 */
import type { FontResource } from '../../../../resources/fonts/font/types';
import * as logger from '../../../../logger';
import { isGlyphVaried, type FontMetrics, type GlyphVariation } from './fontMetrics';
import { isCanvasFontMetrics } from './runtimeFontMetrics';
import { BUNDLED_FACE, findDrawnFace, fontForcesAutohinter } from './sceneFontResolution';
import { createSettledPeek } from './settledChannel';
import { openAutoHintedFontOutlines, openFontOutlines, type SfntOutlines } from './sfntOutlines';

/** Undefined while the load runs. Null is a font that holds no outlines this reader opens. */
type PeekedOutlines = SfntOutlines | null | undefined;

/** Keyed by the leaf `FontFileResource`, as the metrics are, so a reloaded file is read again and a shared one once. */
const peekOutlines = createSettledPeek<object, SfntOutlines | null>();

/** The cache key of the bundled font, which has no resource. */
const BUNDLED = {};

/** Settles as null for a font this reader cannot open, after a warning. */
function settledOutlines(read: () => Promise<SfntOutlines | null>): Promise<SfntOutlines | null> {
  return read().catch((error: unknown) => {
    logger.warn(`[SceneFont] Failed to read the outlines of a font (${String(error)}).`);
    return null;
  });
}

/**
 * The bundled Open Sans SemiBold, which every font whose face is `BUNDLED_FACE` draws. Its bytes load
 * as their own chunk, so a scene with no TextMesh never fetches them.
 */
function peekBundledOutlines(): PeekedOutlines {
  return peekOutlines(BUNDLED, () =>
    settledOutlines(async () => {
      const { bundledFontBytes } = await import('./bundledFontBytes');
      return openFontOutlines(bundledFontBytes());
    })
  );
}

/**
 * The outlines of `font`, starting their load on the first peek. A chain of fonts with no glyphs, a
 * BMFont, and bytes that hold no outlines this reader opens, are null.
 *
 * @canonical Glyph outlines of a scene font in any container, from its font resource
 */
export function peekSceneFontOutlines(font: FontResource | null | undefined): PeekedOutlines {
  const face = findDrawnFace(font);
  if (face === BUNDLED_FACE) return peekBundledOutlines();
  const bytes = face?.bytes;
  if (!face || !bytes) return null;
  const open = fontForcesAutohinter(face) ? openAutoHintedFontOutlines : openFontOutlines;
  return peekOutlines(face, () => settledOutlines(() => open(bytes)));
}

/**
 * The outlines that the text of the `metrics` face under `variation` follows. Only an emboldened or
 * sheared canvas face needs them, as its fill and its stroke follow the changed glyph: the rest
 * answers null and loads nothing. An atlas face has no contour to follow.
 *
 * @canonical Glyph outlines that the text of an emboldened or sheared canvas face follows
 */
export function peekGlyphOutlines(
  font: FontResource | null | undefined,
  metrics: FontMetrics,
  variation: GlyphVariation
): PeekedOutlines {
  return isCanvasFontMetrics(metrics) && isGlyphVaried(variation) ? peekSceneFontOutlines(font) : null;
}
