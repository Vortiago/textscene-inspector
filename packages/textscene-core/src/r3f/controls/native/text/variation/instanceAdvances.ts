/**
 * The horizontal advance of each glyph of a variable font at one instance, as HarfBuzz reads it from
 * FreeType unhinted (`FT_Get_Advance`, `ftadvanc.c`). A font with `HVAR` adjusts its `hmtx` advance
 * (`tt_get_advances`, `ttdriver.c:274-288`, `ttmtx.c:326`). Any other font loads the glyph, and its advance is the
 * distance of the phantom points that `gvar` moves (`ft_load_advances`, `ttgload.c:1977`).
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { toUint16 } from '../../../../../godot/variant/intWidth';
import { variedGlyfAdvances } from '../sfntGlyf';
import { glyphMetricsReader } from '../sfntGlyphMetrics';
import type { SfntFile } from '../sfntTables';
import type { FontInstance } from './fontInstance';

/** A glyph's advance in design units, or null for a glyph FreeType fails to load. */
export type GlyphAdvanceReader = (glyphIndex: number) => number | null;

/** The advances of `sfnt` at `instance`, or null for a font with no `HVAR` and no `glyf` outlines to load. */
export function instanceAdvanceReader(sfnt: SfntFile, instance: FontInstance): GlyphAdvanceReader | null {
  if (!instance.adjustedAdvances.horizontal) return variedGlyfAdvances(sfnt, instance);
  const metricsOf = glyphMetricsReader(sfnt);
  // `tt_face_get_metrics` adds the delta to the unsigned `hmtx` advance and keeps it unsigned.
  return (glyphIndex) =>
    toUint16(metricsOf(glyphIndex, 0).horizontal.advance + instance.advanceDelta.horizontal(glyphIndex));
}
