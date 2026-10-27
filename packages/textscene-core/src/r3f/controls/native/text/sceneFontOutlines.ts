/**
 * The glyph outlines of a scene font as far as they have loaded, which a TextMesh extrudes: the
 * counterpart of the metrics peek in `sceneFontLoader.ts`, and it answers a settled load through
 * the same channel. A WOFF2 decompresses with Brotli and rebuilds its `glyf`, so the answer is
 * never there on the first peek. It never throws.
 */
import { endsWithoutBase } from '../../../../resources/fonts/font/defaultBaseFont';
import type { FontResource } from '../../../../resources/fonts/font/types';
import * as logger from '../../../../logger';
import { resolveFontFileBytes } from './sceneFontResolution';
import { notifySceneFontSettled } from './sceneFontLoader';
import { openFontOutlines, type SfntOutlines } from './sfntOutlines';

/** Undefined while the load runs. Null is a font that holds no outlines this reader opens. */
type PeekedOutlines = SfntOutlines | null | undefined;

type CacheEntry = { status: 'pending' } | { status: 'settled'; outlines: SfntOutlines | null };

/** Keyed by the leaf `FontFileResource`, as the metrics are, so a reloaded file is read again and a shared one once. */
const outlinesCache = new WeakMap<object, CacheEntry>();

/** The cache key of the bundled font, which has no resource. */
const BUNDLED = {};

/**
 * The bundled Open Sans SemiBold, which `font: null` and a `FontVariation` with no `base_font`
 * draw. Its bytes load as their own chunk, so a scene with no TextMesh never fetches them.
 */
async function readBundledOutlines(): Promise<SfntOutlines | null> {
  const { bundledFontBytes } = await import('./bundledFontBytes');
  return openFontOutlines(bundledFontBytes());
}

/** Reads the outlines under `key` in the background, and wakes the readers that built without them when they settle. */
async function loadOutlines(key: object, read: () => Promise<SfntOutlines | null>): Promise<void> {
  outlinesCache.set(key, { status: 'pending' });
  const outlines = await read().catch((error: unknown) => {
    logger.warn(`[SceneFont] Failed to read the outlines of a font (${String(error)}).`);
    return null;
  });
  outlinesCache.set(key, { status: 'settled', outlines });
  notifySceneFontSettled();
}

/** The settled outlines under `key`, starting their load on the first peek. */
function peekOutlines(key: object, read: () => Promise<SfntOutlines | null>): PeekedOutlines {
  const cached = outlinesCache.get(key);
  if (cached) return cached.status === 'settled' ? cached.outlines : undefined;
  void loadOutlines(key, read);
  return undefined;
}

/**
 * The outlines of `font`, starting their load on the first peek. Null `font` and a
 * `FontVariation` with no `base_font` are the bundled font. A `SystemFont`, which has no bytes, and
 * a chain of fonts with none are null: Godot draws them, this previewer cannot.
 *
 * @canonical Glyph outlines of a scene font in any container, from its font resource
 */
export function peekSceneFontOutlines(font: FontResource | null | undefined): PeekedOutlines {
  if (!font) return peekOutlines(BUNDLED, readBundledOutlines);
  const resolved = resolveFontFileBytes(font);
  if (!resolved) return endsWithoutBase(font) ? peekOutlines(BUNDLED, readBundledOutlines) : null;
  return peekOutlines(resolved.leaf, () => openFontOutlines(resolved.bytes));
}
