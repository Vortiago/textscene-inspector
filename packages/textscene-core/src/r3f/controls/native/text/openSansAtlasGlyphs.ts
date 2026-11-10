/**
 * The atlas bitmap of an Open Sans glyph by its glyph index: a glyph that a `GSUB` lookup gives, such
 * as a ligature, has no character of its own, so the atlas finds it by the character `cmap` maps to it.
 */

import { OPEN_SANS_ATLAS_GLYPHS, type OpenSansGlyph } from './openSansAtlas';
import { openSansShapingSfnt } from './openSansFontMetrics';
import { sfntGlyphIndex } from './sfntCmap';

/** Written once, by the first substituted glyph a layout places. */
let atlasByIndex: ReadonlyMap<number, OpenSansGlyph> | undefined;

/** Each glyph the atlas bakes, by the glyph `cmap` gives its character. */
function readAtlasByIndex(): ReadonlyMap<number, OpenSansGlyph> {
  const glyphIndex = sfntGlyphIndex(openSansShapingSfnt());
  const byIndex = new Map<number, OpenSansGlyph>();
  if (!glyphIndex) return byIndex;
  for (const [char, glyph] of Object.entries(OPEN_SANS_ATLAS_GLYPHS)) byIndex.set(glyphIndex(char.codePointAt(0)!), glyph);
  return byIndex;
}

/** The atlas bitmap of glyph `glyphIndex`, or null for a glyph the atlas does not bake. */
export function atlasGlyphOfIndex(glyphIndex: number): OpenSansGlyph | null {
  atlasByIndex ??= readAtlasByIndex();
  return atlasByIndex.get(glyphIndex) ?? null;
}
