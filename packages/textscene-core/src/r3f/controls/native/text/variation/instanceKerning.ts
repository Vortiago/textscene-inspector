/**
 * The pair kerning of a variable font's `GPOS` `kern` feature at one instance, as HarfBuzz applies it
 * (`PairPosFormat1`, `PairPosFormat2`): in each lookup whose flag matches both glyphs, the first
 * subtable that holds the pair moves the pen by the x advance of both value records, each with the
 * delta its `VariationIndex` device table takes from the `GDEF` item variation store at the instance.
 *
 * Portions ported from HarfBuzz ("Old MIT" licence).
 * Copyright (C) 2007-2026 by Behdad Esfahbod and the HarfBuzz contributors.
 * See THIRD-PARTY-NOTICES.md.
 */

import {
  GposType,
  i16,
  pairValueRecords,
  readLayoutTable,
  u16,
  valueFieldOffset,
  ValueFormat,
  type LayoutTable,
  type PairValueRecord,
} from '../autofit/openTypeLayout';
import {
  canSkipGlyphs,
  gdefOf,
  glyphPropsReader,
  lookupMatcher,
  type LookupGlyph,
} from '../autofit/openTypeGdef';
import type { SfntFile } from '../sfntTables';
import { readFvarAxes } from './fvar';
import { itemDeltaFixed, readItemVariationStore, type ItemVariationStore } from './itemVariationStore';

/** The kerning of a pair of glyphs in design units, with the fraction of its deltas. */
export type PairKerningReader = (left: LookupGlyph, right: LookupGlyph) => number;

const VARIATION_INDEX_FORMAT = 0x8000;
/** `GDEF` 1.3 keeps the offset of its item variation store at this byte. */
const GDEF_VARIATION_STORE_OFFSET = 14;

/** The `GDEF` item variation store, or null for a font whose `GDEF` holds none. */
function gdefVariationStore(sfnt: SfntFile, axisCount: number): ItemVariationStore | null {
  const gdef = gdefOf(sfnt, GDEF_VARIATION_STORE_OFFSET + 4);
  if (!gdef || gdef.minor < 3) return null;
  const storeOffset = sfnt.dv.getUint32(gdef.offset + GDEF_VARIATION_STORE_OFFSET, false);
  return storeOffset === 0 ? null : readItemVariationStore(sfnt.dv, gdef.offset + storeOffset, axisCount);
}

/**
 * The lookups of the `kern` feature in the default language system of every script, ascending.
 * HarfBuzz takes that system for text with no language of the font (`hb-ot-layout.cc:769-804`), and
 * the previewer gives no text a language. A `FeatureVariations` record that swaps them is left out.
 */
function kernLookups({ scripts, features }: LayoutTable): number[] {
  const lookups = new Set<number>();
  for (const { defaultLanguage } of scripts) {
    if (!defaultLanguage) continue;
    const { requiredFeature, features: indices } = defaultLanguage;
    for (const index of requiredFeature === null ? indices : [requiredFeature, ...indices])
      if (features[index]?.tag === 'kern') features[index]!.lookups.forEach((lookup) => lookups.add(lookup));
  }
  return [...lookups].sort((a, b) => a - b);
}

/**
 * The x advance a value record adds, in design units: its own, and the delta of its device table at
 * `normalized` when that table is a `VariationIndex`. A hinting device adds nothing: `hb-ft` sets no
 * ppem (`hb-ft.cc:1365-1368`), and `HintingDevice::get_delta` gives 0 at a ppem of 0 (`hb-ot-layout-common.hh:4840-4849`).
 */
function xAdvanceUnits(
  dv: DataView,
  { at, base, format }: PairValueRecord,
  store: ItemVariationStore | null,
  normalized: Int32Array
): number {
  let units = 0;
  if (format & ValueFormat.X_ADVANCE) units += i16(dv, at + valueFieldOffset(format, ValueFormat.X_ADVANCE));
  if (!(format & ValueFormat.X_ADVANCE_DEVICE) || !store) return units;
  const deviceOffset = u16(dv, at + valueFieldOffset(format, ValueFormat.X_ADVANCE_DEVICE));
  if (deviceOffset === 0) return units;
  const device = base + deviceOffset;
  if (u16(dv, device + 4) !== VARIATION_INDEX_FORMAT) return units;
  return units + itemDeltaFixed(store, u16(dv, device), u16(dv, device + 2), normalized) / 0x10000;
}

/**
 * The kerning reader of `sfnt` at the normalised coordinates of an instance, or null for a font
 * with no `GPOS` `kern` feature.
 */
export function instanceKerningReader(
  sfnt: SfntFile
): ((normalized: Int32Array) => PairKerningReader) | null {
  const gpos = sfnt.tables.get('GPOS');
  const axes = readFvarAxes(sfnt);
  if (!gpos || !axes) return null;
  const table = readLayoutTable(sfnt.dv, gpos.offset, gpos.length, false);
  const pairLookups = kernLookups(table).map((index) => {
    const lookup = table.lookups[index];
    const subtables = (lookup?.subtables ?? []).filter((subtable) => subtable.type === GposType.PAIR);
    return { props: lookup?.props ?? 0, subtables };
  });
  if (pairLookups.every(({ subtables }) => subtables.length === 0)) return null;
  const store = gdefVariationStore(sfnt, axes.length);
  const propsOf = glyphPropsReader(sfnt);
  const matches = lookupMatcher(sfnt);
  const { dv } = sfnt;
  return (normalized) => (left, right) => {
    let glyphProps: [number, number] | undefined;
    let units = 0;
    for (const { props, subtables } of pairLookups) {
      if (canSkipGlyphs(props)) {
        glyphProps ??= [propsOf(left), propsOf(right)];
        // A lookup kerns neither glyph that its flag skips: it skips the left one, and pairs the left one past the right one.
        if (!matches(left.glyph, glyphProps[0], props) || !matches(right.glyph, glyphProps[1], props))
          continue;
      }
      for (const { offset } of subtables) {
        const records = pairValueRecords(dv, offset, left.glyph, right.glyph);
        if (!records) continue;
        units += records.reduce((sum, record) => sum + xAdvanceUnits(dv, record, store, normalized), 0);
        break;
      }
    }
    return units;
  };
}
