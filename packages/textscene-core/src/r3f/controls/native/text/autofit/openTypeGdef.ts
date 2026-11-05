/**
 * The glyph definitions of `GDEF` that a `GPOS` lookup reads, as HarfBuzz reads them: the class of
 * each glyph that a lookup flag skips by (`check_glyph_property`, `hb-ot-layout-gsubgpos.hh:823-838`),
 * and the item variation store of the device tables at an instance.
 *
 * Portions ported from HarfBuzz ("Old MIT" licence).
 * Copyright (C) 2007-2026 by Behdad Esfahbod and the HarfBuzz contributors.
 * See THIRD-PARTY-NOTICES.md.
 */

import { tableFits, type SfntFile } from '../sfntTables';
import { readItemVariationStore, type ItemVariationStore } from '../variation/itemVariationStore';
import { coverageIndex, glyphClass, u16 } from './openTypeLayout';

/** A glyph to match against a lookup flag: its index, and the character it shapes, for a font with no glyph classes. */
export interface LookupGlyph {
  readonly glyph: number;
  readonly codePoint: number;
}

/** Whether a lookup of `props` (`Lookup.props`) matches `glyph`, or skips it. */
export type LookupGlyphMatcher = (glyph: LookupGlyph, props: number) => boolean;

/** `HB_OT_LAYOUT_GLYPH_PROPS_*`, the same bits as the lookup flags that skip each class. */
const BASE_GLYPH_PROPS = 0x02;
const LIGATURE_PROPS = 0x04;
const MARK_PROPS = 0x08;
/** `LookupFlag::IgnoreFlags`: the bits that skip a base glyph, a ligature or a mark. */
const IGNORE_FLAGS = 0x0e;
const USE_MARK_FILTERING_SET = 0x10;
const MARK_ATTACHMENT_TYPE = 0xff00;

const GDEF_BASE_GLYPH = 1;
const GDEF_LIGATURE_GLYPH = 2;
const GDEF_MARK_GLYPH = 3;
const GDEF_GLYPH_CLASS_DEF_OFFSET = 4;
const GDEF_MARK_ATTACH_CLASS_DEF_OFFSET = 10;
/** `GDEF` 1.2 keeps the offset of its mark glyph sets at this byte. */
const GDEF_MARK_GLYPH_SETS_OFFSET = 12;
/** `GDEF` 1.3 keeps the offset of its item variation store at this byte. */
const GDEF_VARIATION_STORE_OFFSET = 14;

const NONSPACING_MARK = /^\p{Mn}$/u;
const DEFAULT_IGNORABLE = /^\p{Default_Ignorable_Code_Point}$/u;

/** The `GDEF` table, at version 1 and at least `minLength` long, as its offset and minor version. */
function gdefOf(sfnt: SfntFile, minLength: number): { offset: number; minor: number } | null {
  const gdef = sfnt.tables.get('GDEF');
  if (!gdef || !tableFits(sfnt.dv, gdef, minLength) || u16(sfnt.dv, gdef.offset) !== 1) return null;
  return { offset: gdef.offset, minor: u16(sfnt.dv, gdef.offset + 2) };
}

/** The table at the 16-bit offset at byte `field` of `GDEF`, or null where the offset is 0. */
function gdefSubtable(dv: DataView, gdef: number, field: number): number | null {
  const offset = u16(dv, gdef + field);
  return offset === 0 ? null : gdef + offset;
}

/**
 * `hb_synthesize_glyph_classes` (`hb-ot-shape.cc:867-890`), which HarfBuzz runs for a font with no
 * `GDEF` glyph classes: a nonspacing mark that is not default-ignorable is a mark, any other a base glyph.
 */
function synthesizedProps(codePoint: number): number {
  const ch = String.fromCodePoint(codePoint);
  return NONSPACING_MARK.test(ch) && !DEFAULT_IGNORABLE.test(ch) ? MARK_PROPS : BASE_GLYPH_PROPS;
}

/** `GDEF::get_glyph_props` (`GDEF.hh:947-963`): the class bits, with a mark's attachment type in the high byte. */
function gdefProps(
  dv: DataView,
  glyphClassDef: number,
  markAttachClassDef: number | null,
  glyph: number
): number {
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
export function lookupGlyphMatcher(sfnt: SfntFile): LookupGlyphMatcher {
  const { dv } = sfnt;
  const gdef = gdefOf(sfnt, GDEF_MARK_GLYPH_SETS_OFFSET);
  const glyphClassDef = gdef && gdefSubtable(dv, gdef.offset, GDEF_GLYPH_CLASS_DEF_OFFSET);
  const markAttachClassDef = gdef && gdefSubtable(dv, gdef.offset, GDEF_MARK_ATTACH_CLASS_DEF_OFFSET);
  const markGlyphSets =
    gdef && gdef.minor >= 2 && tableFits(dv, sfnt.tables.get('GDEF')!, GDEF_MARK_GLYPH_SETS_OFFSET + 2)
      ? gdefSubtable(dv, gdef.offset, GDEF_MARK_GLYPH_SETS_OFFSET)
      : null;
  const propsOf = ({ glyph, codePoint }: LookupGlyph): number =>
    glyphClassDef ? gdefProps(dv, glyphClassDef, markAttachClassDef, glyph) : synthesizedProps(codePoint);

  return (glyph, props) => {
    const glyphProps = propsOf(glyph);
    if (glyphProps & props & IGNORE_FLAGS) return false;
    if (!(glyphProps & MARK_PROPS)) return true;
    if (props & USE_MARK_FILTERING_SET) return markSetCovers(dv, markGlyphSets, props >>> 16, glyph.glyph);
    if (props & MARK_ATTACHMENT_TYPE)
      return (props & MARK_ATTACHMENT_TYPE) === (glyphProps & MARK_ATTACHMENT_TYPE);
    return true;
  };
}

/** The `GDEF` item variation store, or null for a font whose `GDEF` holds none. */
export function gdefVariationStore(sfnt: SfntFile, axisCount: number): ItemVariationStore | null {
  const gdef = gdefOf(sfnt, GDEF_VARIATION_STORE_OFFSET + 4);
  if (!gdef || gdef.minor < 3) return null;
  const storeOffset = sfnt.dv.getUint32(gdef.offset + GDEF_VARIATION_STORE_OFFSET, false);
  return storeOffset === 0 ? null : readItemVariationStore(sfnt.dv, gdef.offset + storeOffset, axisCount);
}
