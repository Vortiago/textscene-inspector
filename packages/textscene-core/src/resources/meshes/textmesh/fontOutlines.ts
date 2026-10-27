/** The glyph outlines of the font file a Font resolves to, parsed once for each file. */

import { parseSfntOutlines, type SfntOutlines } from '../../../r3f/controls/native/text/sfntOutlines';
import { resolveFontFileBytes } from '../../../r3f/controls/native/text/sceneFontResolution';
import { perObject } from '../../../utils/perObject';
import type { FontResource } from '../../fonts/font/types';

/** Keyed by the bytes of a font file. Null is a font without outlines this reader parses. */
const parsedOutlines = perObject(parseSfntOutlines);

/** The outlines of `font`, or null for a font with no loadable bytes or no `glyf` or `CFF ` outlines. */
export function fontOutlines(font: FontResource | null): SfntOutlines | null {
  const resolved = resolveFontFileBytes(font);
  return resolved && parsedOutlines(resolved.bytes);
}
