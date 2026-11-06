/**
 * The glyph outlines of a scene font as far as they have loaded, which a TextMesh extrudes and the
 * canvas painter draws: the counterpart of the metrics peek in `sceneFontLoader.ts`, and it answers
 * a settled load through the same channel. A WOFF2 decompresses with Brotli and rebuilds its `glyf`,
 * so the answer is never there on the first peek. It never throws.
 */
import type { FontResource } from '../../../../resources/fonts/font/types';
import * as logger from '../../../../logger';
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
const peekSettledOutlines = createSettledPeek<object, SfntOutlines | null>();

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
  return peekSettledOutlines(loadKey(font, load), () =>
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
 * The outlines of `face` as `load` loads them, starting the load on the first peek. The bundled
 * Open Sans SemiBold loads its bytes as their own chunk, so a scene with no text drawn from
 * outlines never fetches them. A face with no bytes is null. A BMFont has glyphs with no contours
 * (`bitmapFontOutlines.ts`).
 *
 * @canonical Glyph outlines of a drawn face, at the glyph load the caller picks
 */
export function peekOutlines(face: DrawnFace, load: GlyphLoad): PeekedOutlines {
  if (face === BUNDLED_FACE) return peekLoadedOutlines(BUNDLED, readBundledBytes, load);
  if (face === NO_FACE) return NO_OUTLINES;
  if (face && hasBitmap(face)) return bitmapFontOutlines(face.bitmap);
  const bytes = face?.bytes;
  if (!face || !bytes) return null;
  return peekLoadedOutlines(bytes, () => bytes, load);
}

async function readBundledBytes(): Promise<ArrayBuffer> {
  return (await import('./bundledFontBytes')).bundledFontBytes();
}

/** The load of the contours a TextMesh extrudes (`font_get_glyph_contours`), at a font file's `force_autohinter`. */
function contourLoad(face: DrawnFace): GlyphLoad {
  if (typeof face !== 'object' || !face) return CONTOUR_LOAD;
  return { ...CONTOUR_LOAD, isAutohinterForced: fontForcesAutohinter(face) };
}

/**
 * The load of the glyphs a canvas face of a font file draws, as Godot loads its glyph bitmaps: at
 * the font's `hinting` (`text_server_adv.cpp:1270-1285`).
 */
export function drawLoad(face: FileWithBytes): GlyphLoad {
  return { hinting: fontHinting(face), isAutohinterForced: fontForcesAutohinter(face) };
}

/**
 * The outlines of `font` that a TextMesh extrudes. A chain of fonts with no glyphs, and bytes that
 * hold no outlines this reader opens, are null.
 */
export function peekSceneFontOutlines(font: FontResource | null | undefined): PeekedOutlines {
  const face = findDrawnFace(font);
  return peekOutlines(face, contourLoad(face));
}
