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
import { perObject } from '../../../../utils/perObject';
import { CONTOUR_LOAD, openFontOutlines, type GlyphLoad, type SfntOutlines } from './sfntOutlines';

/** Undefined while the load runs. Null is a font that holds no outlines this reader opens. */
type PeekedOutlines = SfntOutlines | null | undefined;

/**
 * The outlines of each load of a font's bytes (`loadKey`): a TextMesh extrudes the contours
 * `font_get_glyph_contours` loads, and the canvas draws the glyphs its font's `hinting` loads. Keyed
 * by the bytes, as the metrics are, so a reloaded file is read again, and a shared one or a copy of
 * it (`withDefaultFonts`) once.
 */
const peekOutlines = createSettledPeek<object, SfntOutlines | null>();

/** The cache key of the bundled font's bytes, which have no resource. */
const BUNDLED = {};

/** The key of each load of a font's bytes, built on the first ask: the bytes alone do not tell two loads apart. */
const loadKeys = perObject((_bytes: object) => new Map<string, object>());

/** The cache key of `bytes` as `load` loads them. */
function loadKey(bytes: object, { hinting, isAutohinterForced }: GlyphLoad): object {
  const keys = loadKeys(bytes);
  const name = `${hinting},${isAutohinterForced}`;
  let key = keys.get(name);
  if (!key) keys.set(name, (key = {}));
  return key;
}

/** The outlines of the font `readBytes` gives, keyed by `font`, as `load` loads them, starting the load on the first peek. */
function peekLoadedOutlines(
  font: object,
  readBytes: () => ArrayBuffer | Promise<ArrayBuffer>,
  load: GlyphLoad
): PeekedOutlines {
  return peekOutlines(loadKey(font, load), () =>
    settledOutlines(async () => openFontOutlines(await readBytes(), load))
  );
}

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
function peekBundledOutlines(load: GlyphLoad): PeekedOutlines {
  const readBytes = async () => (await import('./bundledFontBytes')).bundledFontBytes();
  return peekLoadedOutlines(BUNDLED, readBytes, load);
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
  if (face === BUNDLED_FACE) return peekBundledOutlines(CONTOUR_LOAD);
  if (face === NO_FACE) return NO_OUTLINES;
  if (face && hasBitmap(face)) return bitmapFontOutlines(face.bitmap);
  const bytes = face?.bytes;
  if (!face || !bytes) return null;
  return peekLoadedOutlines(bytes, () => bytes, {
    ...CONTOUR_LOAD,
    isAutohinterForced: fontForcesAutohinter(face),
  });
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
  return peekLoadedOutlines(face.bytes, () => face.bytes, {
    hinting: fontHinting(face),
    isAutohinterForced: fontForcesAutohinter(face),
  });
}

/**
 * The outlines that the text of the bundled canvas face draws from, at `hinting`, the project's
 * `gui/theme/default_font_hinting`.
 */
export function peekBundledGlyphOutlines(hinting: FontHinting): PeekedOutlines {
  return peekBundledOutlines({ hinting, isAutohinterForced: false });
}
