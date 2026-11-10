/**
 * The auto-hinter's view of a font (`AutofitFace`): its Unicode `cmap`, its `GSUB` and `GPOS`
 * tables, its italic style flag as FreeType's `sfobjs.c` sets it, and its glyphs in design units.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { UnscaledOutlines } from '../glyphContours';
import { cmapCodePoints, cmapLookup } from '../sfntCmap';
import { OS2_FS_SELECTION_OFFSET, OS2_TABLE_MIN_LENGTH, tableFits, type SfntFile } from '../sfntTables';
import type { AutofitFace } from './afFace';
import { sfntGpos, sfntGsub } from './openTypeLayout';

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

/** The face of a font with `outlines` and a `cmap`, or null for a font without a readable `cmap`. */
export function sfntAutofitFace(sfnt: SfntFile, outlines: UnscaledOutlines): AutofitFace | null {
  const cmap = sfnt.tables.get('cmap');
  const lookup = cmap && cmapLookup(sfnt.dv, cmap.offset);
  if (!cmap || !lookup) return null;
  const { glyphCount } = outlines;
  return {
    ...outlines,
    isItalic: isItalicFace(sfnt),
    codePoints: cmapCodePoints(sfnt.dv, cmap.offset, glyphCount) ?? [],
    glyphIndex: (codePoint) => {
      const glyph = lookup(codePoint);
      return glyph < glyphCount ? glyph : 0;
    },
    gsub: sfntGsub(sfnt),
    gpos: sfntGpos(sfnt),
  };
}
