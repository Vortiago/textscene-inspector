/**
 * The glyph outlines of a scene font as far as they have loaded, which a TextMesh extrudes: the
 * counterpart of the metrics peek in `sceneFontLoader.ts`, and it answers a settled load through
 * the same channel. A WOFF2 decompresses with Brotli and rebuilds its `glyf`, so the answer is
 * never there on the first peek. It never throws.
 */
import { decodeBase64Bytes } from '../../../../godot/variant/packedBytes';
import { endsWithoutBase } from '../../../../resources/fonts/font/defaultBaseFont';
import type { FontFileResource, FontResource } from '../../../../resources/fonts/font/types';
import * as logger from '../../../../logger';
import { resolveFontFileBytes } from './sceneFontResolution';
import { notifySceneFontMetricsSettled } from './sceneFontLoader';
import { openFontOutlines, type SfntOutlines } from './sfntOutlines';

/** Undefined while the load runs. Null is a font that holds no outlines this reader opens. */
type PeekedOutlines = SfntOutlines | null | undefined;

type CacheEntry = { status: 'pending' } | { status: 'settled'; outlines: SfntOutlines | null };

/** Keyed by the leaf `FontFileResource`, as the metrics are, so a reloaded file is read again and a shared one once. */
const outlinesCache = new WeakMap<FontFileResource, CacheEntry>();

/** Written only by `loadBundledOutlines`, once. Undefined until its load settles. */
let bundledOutlines: PeekedOutlines;
let bundledLoad: Promise<void> | undefined;

/** Reads the bytes of `font` in the background, and wakes the readers that built without them when they settle. */
async function loadOutlines(font: FontFileResource, bytes: ArrayBuffer): Promise<void> {
  outlinesCache.set(font, { status: 'pending' });
  const outlines = await openFontOutlines(bytes).catch((error: unknown) => {
    logger.warn(`[SceneFont] Failed to read the outlines of a scene font (${String(error)}).`);
    return null;
  });
  outlinesCache.set(font, { status: 'settled', outlines });
  notifySceneFontMetricsSettled();
}

/**
 * The bundled Open Sans SemiBold, which `font: null` and a `FontVariation` with no `base_font`
 * draw. Its bytes load as their own chunk, so a scene with no TextMesh never fetches them.
 */
async function loadBundledOutlines(): Promise<void> {
  try {
    const { OPEN_SANS_WOFF2_BASE64 } = await import('./openSansFontBytes');
    bundledOutlines = await openFontOutlines(decodeBase64Bytes(OPEN_SANS_WOFF2_BASE64).buffer);
  } catch (error) {
    logger.warn(`[BundledFont] Failed to read the bundled font's outlines (${String(error)}).`);
    bundledOutlines = null;
  }
  notifySceneFontMetricsSettled();
}

function peekBundledOutlines(): PeekedOutlines {
  bundledLoad ??= loadBundledOutlines();
  return bundledOutlines;
}

/**
 * The outlines of `font`, starting their load on the first peek. Null `font` and a
 * `FontVariation` with no `base_font` are the bundled font. A `SystemFont`, which has no bytes, and
 * a chain of fonts with none are null: Godot draws them, this previewer cannot.
 *
 * @canonical Glyph outlines of a scene font in any container, from its font resource
 */
export function peekSceneFontOutlines(font: FontResource | null | undefined): PeekedOutlines {
  if (!font) return peekBundledOutlines();
  const resolved = resolveFontFileBytes(font);
  if (!resolved) return endsWithoutBase(font) ? peekBundledOutlines() : null;

  const cached = outlinesCache.get(resolved.leaf);
  if (cached) return cached.status === 'settled' ? cached.outlines : undefined;
  void loadOutlines(resolved.leaf, resolved.bytes);
  return undefined;
}
