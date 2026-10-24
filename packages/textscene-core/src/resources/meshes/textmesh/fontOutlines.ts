/** The glyph outlines of the font file a Font resolves to, parsed once for each file. */

import { parseSfntOutlines, type SfntOutlines } from '../../../r3f/controls/native/text/sfntOutlines';
import { resolveFontFileBytes } from '../../../r3f/controls/native/text/sceneFontResolution';
import type { FontFileResource, FontResource } from '../../fonts/font/types';

/**
 * Written only by `fontOutlines`, keyed by the file a font resolves to. Null is a font with no
 * TrueType outlines. A `WeakMap` frees the entry of an evicted font file.
 */
const parsedFiles = new WeakMap<FontFileResource, SfntOutlines | null>();

/** The outlines of `font`, or null for a font with no loadable bytes or no `glyf` table. */
export function fontOutlines(font: FontResource | null): SfntOutlines | null {
  const resolved = resolveFontFileBytes(font);
  if (!resolved) return null;
  if (!parsedFiles.has(resolved.leaf)) parsedFiles.set(resolved.leaf, parseSfntOutlines(resolved.bytes));
  return parsedFiles.get(resolved.leaf)!;
}
