/**
 * The glyph outlines of a scene font as far as they have loaded, which a TextMesh extrudes and the
 * canvas painter draws: the counterpart of the metrics peek in `sceneFontLoader.ts`, and it answers
 * a settled load through the same channel. A WOFF2 decompresses with Brotli and rebuilds its `glyf`,
 * so the answer is never there on the first peek. It never throws.
 */
import type { FontResource } from '../../../../resources/fonts/font/types';
import type { FontHinting } from '../../../../godot/text/textServerEnums';
import * as logger from '../../../../logger';
import type { FontMetrics } from './fontMetrics';
import { isCanvasFontMetrics } from './runtimeFontMetrics';
import { bitmapFontOutlines } from './bitmapFontOutlines';
import {
  BUNDLED_FACE,
  NO_FACE,
  findDrawnFace,
  fontForcesAutohinter,
  fontHinting,
  hasBitmap,
  type DrawnFace,
  type FileWithBytes,
} from './sceneFontResolution';
import { createSettledPeek } from './settledChannel';
import { CONTOUR_LOAD, openFontOutlines, type GlyphLoad, type SfntOutlines } from './sfntOutlines';

/** Undefined while the load runs. Null is a font that holds no outlines this reader opens. */
type PeekedOutlines = SfntOutlines | null | undefined;

/**
 * The outlines of each load: a TextMesh extrudes the contours `font_get_glyph_contours` loads, and
 * the canvas draws the glyphs its font's `hinting` loads. Keyed by the leaf `FontFileResource`, as
 * the metrics are, so a reloaded file is read again and a shared one once.
 */
const peekContourOutlines = createSettledPeek<object, SfntOutlines | null>();
const peekCanvasOutlines = createSettledPeek<object, SfntOutlines | null>();

/** The cache keys of the bundled font, which has no resource: one for each load. */
const BUNDLED_CONTOURS = {};
const BUNDLED_CANVAS: Record<FontHinting, object> = { none: {}, light: {}, normal: {} };

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
 * The bundled Open Sans SemiBold, which every font whose face is `BUNDLED_FACE` draws, as `load`
 * loads it. Its bytes load as their own chunk, so a scene with no text drawn from outlines never
 * fetches them.
 */
function peekBundledOutlines(peek: typeof peekContourOutlines, key: object, load: GlyphLoad): PeekedOutlines {
  return peek(key, () =>
    settledOutlines(async () => {
      const { bundledFontBytes } = await import('./bundledFontBytes');
      return openFontOutlines(bundledFontBytes(), load);
    })
  );
}

/**
 * The outlines of `font` that a TextMesh extrudes, starting their load on the first peek. A chain of
 * fonts with no glyphs, and bytes that hold no outlines this reader opens, are null. A BMFont has
 * glyphs with no contours (`bitmapFontOutlines.ts`).
 *
 * @canonical Glyph outlines of a scene font in any container, from its font resource
 */
export function peekSceneFontOutlines(font: FontResource | null | undefined): PeekedOutlines {
  const face: DrawnFace = findDrawnFace(font);
  if (face === BUNDLED_FACE) return peekBundledOutlines(peekContourOutlines, BUNDLED_CONTOURS, CONTOUR_LOAD);
  if (face === NO_FACE) return NO_OUTLINES;
  if (face && hasBitmap(face)) return bitmapFontOutlines(face.bitmap);
  const bytes = face?.bytes;
  if (!face || !bytes) return null;
  const load = { ...CONTOUR_LOAD, isAutohinterForced: fontForcesAutohinter(face) };
  return peekContourOutlines(face, () => settledOutlines(() => openFontOutlines(bytes, load)));
}

/**
 * The outlines that the text of the `metrics` face of a font file draws from, as Godot loads its
 * glyph bitmaps: at the font's `hinting` (`text_server_adv.cpp:1270-1285`). A canvas face draws
 * every glyph from its outline. An atlas face has no contour to follow, and answers null.
 *
 * @canonical Glyph outlines that the text of a canvas face draws from
 */
export function peekGlyphOutlines(face: FileWithBytes, metrics: FontMetrics): PeekedOutlines {
  if (!isCanvasFontMetrics(metrics)) return null;
  const load = { hinting: fontHinting(face), isAutohinterForced: fontForcesAutohinter(face) };
  return peekCanvasOutlines(face, () => settledOutlines(() => openFontOutlines(face.bytes, load)));
}

/**
 * The outlines that the text of the bundled canvas face draws from, at `hinting`, the project's
 * `gui/theme/default_font_hinting`.
 */
export function peekBundledGlyphOutlines(hinting: FontHinting): PeekedOutlines {
  const load = { hinting, isAutohinterForced: false };
  return peekBundledOutlines(peekCanvasOutlines, BUNDLED_CANVAS[hinting], load);
}
