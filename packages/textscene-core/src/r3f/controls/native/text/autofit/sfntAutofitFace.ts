/**
 * The auto-hinter's view of a `glyf` font (`AutofitFace`): its Unicode `cmap`, its `GSUB` and
 * `GPOS` tables, its italic style flag as FreeType's `sfobjs.c` sets it, and its glyphs in font
 * units.
 */

import { cmapCodePoints, cmapLookup } from '../sfntCmap';
import { glyfSize, unscaledGlyphReader } from '../sfntGlyf';
import { OS2_FS_SELECTION_OFFSET, OS2_TABLE_MIN_LENGTH, tableFits, type SfntFile } from '../sfntTables';
import type { AutofitFace } from './afFace';
import { readLayoutTable, type LayoutTable } from './openTypeLayout';

/** `OS/2.fsSelection` bit 0, italic, and bit 9, oblique. */
const FS_SELECTION_ITALIC = 1 << 0;
const FS_SELECTION_OBLIQUE = 1 << 9;
/** `head.macStyle` at 44, and its italic bit 1. */
const HEAD_MAC_STYLE_OFFSET = 44;
const MAC_STYLE_ITALIC = 1 << 1;

/** `FT_STYLE_FLAG_ITALIC`: from `OS/2` when FreeType loads it, else from `head`. */
function isItalicFace(sfnt: SfntFile): boolean {
  const { dv, tables } = sfnt;
  const os2 = tables.get('OS/2');
  if (os2 && tableFits(dv, os2, OS2_TABLE_MIN_LENGTH))
    return (
      (dv.getUint16(os2.offset + OS2_FS_SELECTION_OFFSET, false) &
        (FS_SELECTION_ITALIC | FS_SELECTION_OBLIQUE)) !==
      0
    );
  const head = tables.get('head');
  return (
    !!head &&
    tableFits(dv, head, HEAD_MAC_STYLE_OFFSET + 2) &&
    (dv.getUint16(head.offset + HEAD_MAC_STYLE_OFFSET, false) & MAC_STYLE_ITALIC) !== 0
  );
}

function layoutTableOf(sfnt: SfntFile, tag: 'GSUB' | 'GPOS'): LayoutTable | null {
  const table = sfnt.tables.get(tag);
  return table ? readLayoutTable(sfnt.dv, table.offset, table.length, tag === 'GSUB') : null;
}

/** The face of a `glyf` font with a `cmap`, or null for another font. */
export function sfntAutofitFace(sfnt: SfntFile): AutofitFace | null {
  const cmap = sfnt.tables.get('cmap');
  const size = glyfSize(sfnt);
  const unscaledGlyph = unscaledGlyphReader(sfnt);
  const lookup = cmap && cmapLookup(sfnt.dv, cmap.offset);
  if (!cmap || !size || !unscaledGlyph || !lookup) return null;
  const { glyphCount } = size;
  return {
    unitsPerEm: size.unitsPerEm,
    glyphCount,
    isItalic: isItalicFace(sfnt),
    codePoints: cmapCodePoints(sfnt.dv, cmap.offset, glyphCount) ?? [],
    glyphIndex: (codePoint) => {
      const glyph = lookup(codePoint);
      return glyph < glyphCount ? glyph : 0;
    },
    gsub: layoutTableOf(sfnt, 'GSUB'),
    gpos: layoutTableOf(sfnt, 'GPOS'),
    unscaledGlyph,
  };
}
