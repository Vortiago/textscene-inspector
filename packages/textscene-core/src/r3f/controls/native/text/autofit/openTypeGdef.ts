/**
 * The glyph definitions of `GDEF` that a lookup flag skips glyphs by, as HarfBuzz reads them: the
 * props of each glyph, and whether a lookup matches a glyph of those props (`check_glyph_property`,
 * `hb-ot-layout-gsubgpos.hh:823-838`).
 *
 * Portions ported from HarfBuzz ("Old MIT" licence).
 * Copyright (C) 2007-2026 by Behdad Esfahbod and the HarfBuzz contributors.
 * See THIRD-PARTY-NOTICES.md.
 */

import { tableFits, type SfntFile } from '../sfntTables';
import { coverageIndex, glyphClass, LookupFlag, u16 } from './openTypeLayout';

/** A glyph to match against a lookup flag: its index, and the character it shapes, for a font with no glyph classes. */
export interface LookupGlyph {
  readonly glyph: number;
  readonly codePoint: number;
}

/** `HB_OT_LAYOUT_GLYPH_PROPS_*`: the same bits as the lookup flags that skip each class. */
const BASE_GLYPH_PROPS = LookupFlag.IGNORE_BASE_GLYPHS;
const LIGATURE_PROPS = LookupFlag.IGNORE_LIGATURES;
export const MARK_PROPS = LookupFlag.IGNORE_MARKS;
/** `LookupFlag::IgnoreFlags`: the bits that skip a base glyph, a ligature or a mark. */
const IGNORE_FLAGS = BASE_GLYPH_PROPS | LIGATURE_PROPS | MARK_PROPS;

const GDEF_BASE_GLYPH = 1;
const GDEF_LIGATURE_GLYPH = 2;
const GDEF_MARK_GLYPH = 3;
const GDEF_GLYPH_CLASS_DEF_OFFSET = 4;
const GDEF_MARK_ATTACH_CLASS_DEF_OFFSET = 10;
/** The size of a `GDEF` 1.0 header: the version and four offsets. */
const GDEF_1_0_HEADER_SIZE = 12;
/** `GDEF` 1.2 keeps the offset of its mark glyph sets at this byte. */
const GDEF_MARK_GLYPH_SETS_OFFSET = 12;

const NONSPACING_MARK = /^\p{Mn}$/u;
const DEFAULT_IGNORABLE = /^\p{Default_Ignorable_Code_Point}$/u;

/** A `GDEF` table at version 1: where it starts, and its minor version. */
export interface Gdef {
  readonly offset: number;
  readonly minor: number;
}

/** The `GDEF` table, at version 1 and at least `minLength` long, or null for a font without one. */
export function gdefOf(sfnt: SfntFile, minLength: number): Gdef | null {
  const gdef = sfnt.tables.get('GDEF');
  if (!gdef || !tableFits(sfnt.dv, gdef, minLength) || u16(sfnt.dv, gdef.offset) !== 1) return null;
  return { offset: gdef.offset, minor: u16(sfnt.dv, gdef.offset + 2) };
}

/** The table at the 16-bit offset at byte `field` of `GDEF`, or null where the offset is 0. */
function gdefSubtable(dv: DataView, { offset }: Gdef, field: number): number | null {
  const subtable = u16(dv, offset + field);
  return subtable === 0 ? null : offset + subtable;
}

/**
 * `hb_synthesize_glyph_classes` (`hb-ot-shape.cc:867-890`), which HarfBuzz runs for a font with no
 * `GDEF` glyph classes: a nonspacing mark that is not default-ignorable is a mark, any other a base glyph.
 */
function synthesizedProps({ codePoint }: LookupGlyph): number {
  const ch = String.fromCodePoint(codePoint);
  return NONSPACING_MARK.test(ch) && !DEFAULT_IGNORABLE.test(ch) ? MARK_PROPS : BASE_GLYPH_PROPS;
}

/**
 * The props of each glyph of `sfnt` (`GDEF::get_glyph_props`, `GDEF.hh:947-963`): the class bits,
 * with a mark's attachment type in the high byte, or the classes HarfBuzz makes up for a font without them.
 */
export function glyphPropsReader(sfnt: SfntFile): (glyph: LookupGlyph) => number {
  const { dv } = sfnt;
  const gdef = gdefOf(sfnt, GDEF_1_0_HEADER_SIZE);
  const glyphClassDef = gdef && gdefSubtable(dv, gdef, GDEF_GLYPH_CLASS_DEF_OFFSET);
  if (!gdef || glyphClassDef === null) return synthesizedProps;
  const markAttachClassDef = gdefSubtable(dv, gdef, GDEF_MARK_ATTACH_CLASS_DEF_OFFSET);
  return ({ glyph }) => {
    switch (glyphClass(dv, glyphClassDef, glyph)) {
      case GDEF_BASE_GLYPH:
        return BASE_GLYPH_PROPS;
      case GDEF_LIGATURE_GLYPH:
        return LIGATURE_PROPS;
      case GDEF_MARK_GLYPH:
        return (
          MARK_PROPS | ((markAttachClassDef === null ? 0 : glyphClass(dv, markAttachClassDef, glyph)) << 8)
        );
      default:
        return 0;
    }
  };
}

/** The mark glyph sets of `GDEF` 1.2, or null for a table without them. */
function markGlyphSetsOf(sfnt: SfntFile): number | null {
  const gdef = gdefOf(sfnt, GDEF_MARK_GLYPH_SETS_OFFSET + 2);
  return gdef && gdef.minor >= 2 ? gdefSubtable(sfnt.dv, gdef, GDEF_MARK_GLYPH_SETS_OFFSET) : null;
}

/** `MarkGlyphSets::covers`: whether the mark glyph set `set` holds `glyph`. A set the table lacks holds none. */
function markSetCovers(dv: DataView, markGlyphSets: number | null, set: number, glyph: number): boolean {
  if (markGlyphSets === null || u16(dv, markGlyphSets) !== 1 || set >= u16(dv, markGlyphSets + 2))
    return false;
  const coverage = dv.getUint32(markGlyphSets + 4 + 4 * set, false);
  return coverage !== 0 && coverageIndex(dv, markGlyphSets + coverage, glyph) >= 0;
}

/**
 * `check_glyph_property` and `match_properties_mark` (`hb-ot-layout-gsubgpos.hh:800-838`) for the
 * glyphs of `sfnt`: a lookup skips a glyph whose class its flag ignores, and a mark that its mark
 * filtering set or its mark attachment type leaves out.
 */
export function lookupMatcher(
  sfnt: SfntFile
): (glyph: number, glyphProps: number, lookupProps: number) => boolean {
  const { dv } = sfnt;
  const markGlyphSets = markGlyphSetsOf(sfnt);
  return (glyph, glyphProps, lookupProps) => {
    if (glyphProps & lookupProps & IGNORE_FLAGS) return false;
    if (!(glyphProps & MARK_PROPS)) return true;
    if (lookupProps & LookupFlag.USE_MARK_FILTERING_SET)
      return markSetCovers(dv, markGlyphSets, lookupProps >>> 16, glyph);
    const attachmentType = lookupProps & LookupFlag.MARK_ATTACHMENT_TYPE;
    return !attachmentType || attachmentType === (glyphProps & LookupFlag.MARK_ATTACHMENT_TYPE);
  };
}
