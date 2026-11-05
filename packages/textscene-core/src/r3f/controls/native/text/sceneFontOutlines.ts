/**
 * The glyph outlines of a scene font as far as they have loaded, which a TextMesh extrudes: the
 * counterpart of the metrics peek in `sceneFontLoader.ts`, and it answers a settled load through
 * the same channel. A WOFF2 decompresses with Brotli and rebuilds its `glyf`, so the answer is
 * never there on the first peek. It never throws.
 */
import { endsWithoutBase } from '../../../../resources/fonts/font/defaultBaseFont';
import type { FontResource } from '../../../../resources/fonts/font/types';
import * as logger from '../../../../logger';
import type { FontMetrics } from './fontMetrics';
import { isCanvasFontMetrics } from './runtimeFontMetrics';
import { bitmapFontOutlines } from './bitmapFontOutlines';
import { fontForcesAutohinter, resolveBitmapFont, resolveFontFileBytes } from './sceneFontResolution';
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
 * The bundled Open Sans SemiBold, which `font: null` and a `FontVariation` with no `base_font`
 * draw. Its bytes load as their own chunk, so a scene with no TextMesh never fetches them.
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
 * The outlines of `font`, starting their load on the first peek. Null `font` and a
 * `FontVariation` with no `base_font` are the bundled font. A `SystemFont`, which has no bytes, and
 * a chain of fonts with none are null: Godot draws them, this previewer cannot. A BMFont has glyphs
 * with no contours (`bitmapFontOutlines.ts`).
 *
 * @canonical Glyph outlines of a scene font in any container, from its font resource
 */
export function peekSceneFontOutlines(font: FontResource | null | undefined): PeekedOutlines {
  if (!font) return peekBundledOutlines();
  const bitmap = resolveBitmapFont(font);
  if (bitmap) return bitmapFontOutlines(bitmap);
  const resolved = resolveFontFileBytes(font);
  if (!resolved) return endsWithoutBase(font) ? peekBundledOutlines() : null;
  const open = fontForcesAutohinter(resolved.leaf) ? openAutoHintedFontOutlines : openFontOutlines;
  return peekOutlines(resolved.leaf, () => settledOutlines(() => open(resolved.bytes)));
}

/**
 * The outlines that the text of the `metrics` face draws from: a canvas face draws every glyph from
 * its outline, as Godot's FreeType does. An atlas face has no contour to follow, and answers null.
 *
 * @canonical Glyph outlines that the text of a canvas face draws from
 */
export function peekGlyphOutlines(
  font: FontResource | null | undefined,
  metrics: FontMetrics
): PeekedOutlines {
  return isCanvasFontMetrics(metrics) ? peekSceneFontOutlines(font) : null;
}
