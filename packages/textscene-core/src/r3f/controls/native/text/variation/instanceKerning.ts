/**
 * The pair kerning of a variable font's default `GPOS` features at one instance, as HarfBuzz applies
 * it (`PairPosFormat1`, `PairPosFormat2`): in each lookup whose flag matches both glyphs, the first
 * subtable that holds the pair moves the pen by the x advance of both value records, each with the
 * delta its `VariationIndex` device table takes from the `GDEF` item variation store at the instance.
 *
 * Portions ported from HarfBuzz ("Old MIT" licence).
 * Copyright (C) 2007-2026 by Behdad Esfahbod and the HarfBuzz contributors.
 * See THIRD-PARTY-NOTICES.md.
 */

import {
  DEFAULT_FEATURES,
  type FeatureSubstitution,
  GposType,
  i16,
  languageFeatures,
  pairValueRecords,
  sfntGpos,
  u16,
  valueFieldOffset,
  ValueFormat,
  type LayoutTable,
  type PairValueRecord,
  type Subtable,
} from '../autofit/openTypeLayout';
import { gdefOf, glyphPropsReader, lookupMatcher, type LookupGlyph } from '../autofit/openTypeGdef';
import { FIXED_16_16_ONE } from '../fontMetrics';
import type { SfntFile } from '../sfntTables';
import { featureLookupsAt } from '../autofit/openTypeFeatures';
import { featureSubstitutionOfInstance } from './instanceRecord';
import { fvarAxesOf } from './fvar';
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
 * The lookups of the default language system of every script, of the features HarfBuzz turns on by
 * default, ascending. HarfBuzz takes that system for text with no language of the font
 * (`hb-ot-layout.cc:769-804`), and the previewer gives no text a language. The reader keeps their
 * pair subtables. A feature takes the lookups that `substitution`, the `FeatureVariations` record
 * that holds at the instance, gives it.
 */
function kernLookups(table: LayoutTable, substitution: FeatureSubstitution | undefined): number[] {
  const lookups = new Set<number>();
  for (const { defaultLanguage } of table.scripts) {
    if (!defaultLanguage) continue;
    for (const index of languageFeatures(table, defaultLanguage, DEFAULT_FEATURES))
      featureLookupsAt(table, index, substitution).forEach((lookup) => lookups.add(lookup));
  }
  return [...lookups].sort((a, b) => a - b);
}

/** A kerning lookup's flag, and the pair subtables it holds. */
interface PairLookup {
  props: number;
  subtables: readonly Subtable[];
}

/** The kerning lookups that hold a pair subtable, each with its pair subtables only. */
function pairLookupsOf(table: LayoutTable, substitution: FeatureSubstitution | undefined): PairLookup[] {
  const pairLookups: PairLookup[] = [];
  for (const index of kernLookups(table, substitution)) {
    const lookup = table.lookups[index];
    if (!lookup) continue;
    const subtables = lookup.subtables.filter((subtable) => subtable.type === GposType.PAIR);
    if (subtables.length > 0) pairLookups.push({ props: lookup.props, subtables });
  }
  return pairLookups;
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
  return units + itemDeltaFixed(store, u16(dv, device), u16(dv, device + 2), normalized) / FIXED_16_16_ONE;
}

/**
 * The kerning reader of `sfnt` at the normalised coordinates of an instance, or null for a font
 * with no pair lookup in its default `GPOS` kerning features. An instance may hold a
 * `FeatureVariations` record that gives those features other lookups.
 */
export function instanceKerningReader(
  sfnt: SfntFile
): ((normalized: Int32Array) => PairKerningReader) | null {
  const table = sfntGpos(sfnt);
  if (!table) return null;
  const axisCount = axisCountOf(sfnt);
  const pairLookupsByRecord = new Map<FeatureSubstitution | undefined, PairLookup[]>();
  const pairLookupsOfRecord = (record: FeatureSubstitution | undefined): PairLookup[] => {
    let found = pairLookupsByRecord.get(record);
    if (!found) pairLookupsByRecord.set(record, (found = pairLookupsOf(table, record)));
    return found;
  };
  const hasPairLookups = [undefined, ...table.featureSubstitutions].some(
    (record) => pairLookupsOfRecord(record).length > 0
  );
  if (!hasPairLookups) return null;
  const store = gdefVariationStore(sfnt, axisCount);
  const propsOf = glyphPropsReader(sfnt);
  const matches = lookupMatcher(sfnt);
  const { dv } = sfnt;
  return (normalized) => {
    const pairLookups = pairLookupsOfRecord(featureSubstitutionOfInstance(table, normalized));
    return (left, right) => {
      const leftProps = propsOf(left);
      const rightProps = propsOf(right);
      let units = 0;
      for (const { props, subtables } of pairLookups) {
        // A lookup kerns neither glyph that its flag skips: it skips the left one, and pairs the left one past the right one.
        if (!matches(left.glyph, leftProps, props) || !matches(right.glyph, rightProps, props)) continue;
        for (const { offset } of subtables) {
          const records = pairValueRecords(dv, offset, left.glyph, right.glyph);
          if (!records) continue;
          let pairUnits = 0;
          for (const record of records) pairUnits += xAdvanceUnits(dv, record, store, normalized);
          units += pairUnits;
          break;
        }
      }
      return units;
    };
  };
}

/** The kerning reader of `sfnt` at its default instance, or null for a font with no pair kerning. */
export function defaultKerningReader(sfnt: SfntFile): PairKerningReader | null {
  return instanceKerningReader(sfnt)?.(new Int32Array(axisCountOf(sfnt))) ?? null;
}

/** The axes of `sfnt`: a font with no `fvar` has one instance, at no coordinates. */
const axisCountOf = (sfnt: SfntFile): number => fvarAxesOf(sfnt)?.length ?? 0;
