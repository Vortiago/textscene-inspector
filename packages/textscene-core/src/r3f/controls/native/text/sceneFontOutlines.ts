/**
 * The glyph outlines of a scene font as far as they have loaded, which a TextMesh extrudes: the
 * counterpart of the metrics peek in `sceneFontLoader.ts`, and it answers a settled load through
 * the same channel. A WOFF2 decompresses with Brotli and rebuilds its `glyf`, so the answer is
 * never there on the first peek. It never throws.
 */
import type { FontResource } from '../../../../resources/fonts/font/types';
import * as logger from '../../../../logger';
import { isGlyphVaried, isInstanced, type FontMetrics, type GlyphVariation } from './fontMetrics';
import { isCanvasFontMetrics } from './runtimeFontMetrics';
import { bitmapFontOutlines } from './bitmapFontOutlines';
import {
  BUNDLED_FACE,
  NO_FACE,
  findDrawnFace,
  fontForcesAutohinter,
  hasBitmap,
  type DrawnFace,
} from './sceneFontResolution';
import { createSettledPeek } from './settledChannel';
import { openAutoHintedFontOutlines, openFontOutlines, type SfntOutlines } from './sfntOutlines';

/** Undefined while the load runs. Null is a font that holds no outlines this reader opens. */
type PeekedOutlines = SfntOutlines | null | undefined;

/**
 * Keyed by the bytes of the leaf `FontFileResource`, as the metrics are, so a reloaded file is read
 * again, and a shared one or a copy of it (`withDefaultFonts`) once.
 */
const peekOutlines = createSettledPeek<object, SfntOutlines | null>();

/** {@link peekOutlines} for a face with `force_autohinter`: the bytes alone do not tell the two readers apart. */
const peekAutoHintedOutlines = createSettledPeek<object, SfntOutlines | null>();

/** The cache key of the bundled font, which has no resource. */
const BUNDLED = {};

/** The outlines of a font with no face: it lacks every glyph, so a TextMesh draws each as its fallback quad. */
const NO_OUTLINES: SfntOutlines = { glyphIndex: () => 0, glyphContours: () => null };

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
 * The outlines of `font`, starting their load on the first peek. A chain of fonts with no glyphs, and
 * bytes that hold no outlines this reader opens, are null. A BMFont has glyphs with no contours
 * (`bitmapFontOutlines.ts`).
 *
 * @canonical Glyph outlines of a scene font in any container, from its font resource
 */
export function peekSceneFontOutlines(font: FontResource | null | undefined): PeekedOutlines {
  return peekFaceOutlines(findDrawnFace(font));
}

/** The outlines of the face a font draws, which a caller with the face in hand reads without a second walk. */
function peekFaceOutlines(face: DrawnFace): PeekedOutlines {
  if (face === BUNDLED_FACE) return peekBundledOutlines();
  if (face === NO_FACE) return NO_OUTLINES;
  if (face && hasBitmap(face)) return bitmapFontOutlines(face.bitmap);
  const bytes = face?.bytes;
  if (!face || !bytes) return null;
  const [peek, open] = fontForcesAutohinter(face)
    ? [peekAutoHintedOutlines, openAutoHintedFontOutlines]
    : [peekOutlines, openFontOutlines];
  return peek(bytes, () => settledOutlines(() => open(bytes)));
}

/**
 * The outlines that the text of the `metrics` face under `variation` follows. An emboldened or
 * sheared canvas face needs them, as its fill and its stroke follow the changed glyph, and so does
 * one at axis values, as `HVAR` moves its advances: the rest answers null and loads nothing. An
 * atlas face has no contour to follow.
 *
 * @canonical Glyph outlines that the text of an emboldened or sheared canvas face follows
 */
export function peekGlyphOutlines(
  face: DrawnFace,
  metrics: FontMetrics,
  variation: GlyphVariation
): PeekedOutlines {
  const needsOutlines = isGlyphVaried(variation) || isInstanced(variation.opentype);
  return isCanvasFontMetrics(metrics) && needsOutlines ? peekFaceOutlines(face) : null;
}
