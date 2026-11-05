/**
 * The pair kerning of a variable font's `GPOS` `kern` feature at one instance, as HarfBuzz applies it
 * (`PairPosFormat1`, `PairPosFormat2`): in each lookup, the first subtable that holds the pair moves
 * the pen by the x advance of both value records, each with the delta its `VariationIndex` device
 * table takes from the `GDEF` item variation store at the instance.
 *
 * Portions ported from HarfBuzz ("Old MIT" licence).
 * Copyright (C) 2007-2026 by Behdad Esfahbod and the HarfBuzz contributors.
 * See THIRD-PARTY-NOTICES.md.
 */

import {
  collectLookups,
  coverageIndex,
  glyphClass,
  readLayoutTable,
  u16,
  valueRecordSize,
  type LayoutTable,
} from '../autofit/openTypeLayout';
import { tableFits, type SfntFile } from '../sfntTables';
import { readFvarAxes } from './fvar';
import { itemDeltaFixed, readItemVariationStore, type ItemVariationStore } from './itemVariationStore';

/** The kerning of a pair of glyphs in design units, with the fraction of its deltas. */
export type PairKerningReader = (left: number, right: number) => number;

const PAIR_ADJUSTMENT = 2;
const VALUE_X_ADVANCE = 0x4;
const VALUE_X_ADVANCE_DEVICE = 0x40;
/** The value-record fields before the x advance: the x and y placements. */
const FIELDS_BEFORE_X_ADVANCE = 0x3;
/** The value-record fields before the x advance device: the placements, the advances and the placement devices. */
const FIELDS_BEFORE_X_ADVANCE_DEVICE = 0x3f;
const VARIATION_INDEX_FORMAT = 0x8000;
/** `GDEF` 1.3 keeps the offset of its item variation store at this byte. */
const GDEF_VARIATION_STORE_OFFSET = 14;
const GDEF_VERSION_1_3_MINOR = 3;

/**
 * One value record of a pair subtable: where it starts, its format, and the table its device offsets
 * count from, a `PairSet` in format 1 and the subtable in format 2.
 */
interface ValueRecord {
  readonly at: number;
  readonly base: number;
  readonly format: number;
}

/** The `GDEF` item variation store, or null for a font whose `GDEF` holds none. */
function gdefVariationStore(sfnt: SfntFile, axisCount: number): ItemVariationStore | null {
  const gdef = sfnt.tables.get('GDEF');
  if (!gdef || !tableFits(sfnt.dv, gdef, GDEF_VARIATION_STORE_OFFSET + 4)) return null;
  if (u16(sfnt.dv, gdef.offset) !== 1 || u16(sfnt.dv, gdef.offset + 2) < GDEF_VERSION_1_3_MINOR) return null;
  const storeOffset = sfnt.dv.getUint32(gdef.offset + GDEF_VARIATION_STORE_OFFSET, false);
  return storeOffset === 0 ? null : readItemVariationStore(sfnt.dv, gdef.offset + storeOffset, axisCount);
}

/**
 * The lookups of the `kern` feature in every script. A `FeatureVariations` record that swaps them at
 * an instance is left out: this reader keeps the lookups of the default instance.
 */
function kernLookups(table: LayoutTable): number[] {
  const scripts = table.scripts.map((script) => script.tag);
  return collectLookups({ ...table, featureSubstitutions: [] }, scripts, ['kern']);
}

/** The first value record of the pair set at `pairSet` for `right`, or null for a glyph it does not list. */
function pairSetRecord(dv: DataView, pairSet: number, right: number, recordSize: number): number | null {
  const count = u16(dv, pairSet);
  for (let i = 0; i < count; i++) {
    const record = pairSet + 2 + i * (2 + recordSize);
    if (u16(dv, record) === right) return record + 2;
  }
  return null;
}

/** The two value records the pair subtable at `subtable` gives `left` and `right`, or null for a pair it does not hold. */
function pairValueRecords(
  dv: DataView,
  subtable: number,
  left: number,
  right: number
): [ValueRecord, ValueRecord] | null {
  const leftIndex = coverageIndex(dv, subtable + u16(dv, subtable + 2), left);
  if (leftIndex < 0) return null;
  const format1 = u16(dv, subtable + 4);
  const format2 = u16(dv, subtable + 6);
  const size1 = valueRecordSize(format1);
  const recordSize = size1 + valueRecordSize(format2);
  let at: number | null;
  let base = subtable;
  if (u16(dv, subtable) === 1) {
    base = subtable + u16(dv, subtable + 10 + 2 * leftIndex);
    at = pairSetRecord(dv, base, right, recordSize);
  } else {
    const leftClass = glyphClass(dv, subtable + u16(dv, subtable + 8), left);
    const rightClass = glyphClass(dv, subtable + u16(dv, subtable + 10), right);
    const rightClassCount = u16(dv, subtable + 14);
    at =
      leftClass < u16(dv, subtable + 12) && rightClass < rightClassCount
        ? subtable + 16 + (leftClass * rightClassCount + rightClass) * recordSize
        : null;
  }
  if (at === null) return null;
  return [
    { at, base, format: format1 },
    { at: at + size1, base, format: format2 },
  ];
}

/** The number of bytes of the fields of `format` that `fields` selects. */
const fieldBytes = (format: number, fields: number): number => valueRecordSize(format & fields);

/**
 * The x advance a value record adds, in design units: its own, and the delta of its device table at
 * `normalized` when that table is a `VariationIndex`.
 */
function xAdvanceUnits(
  dv: DataView,
  { at, base, format }: ValueRecord,
  store: ItemVariationStore | null,
  normalized: Int32Array
): number {
  let units = 0;
  if (format & VALUE_X_ADVANCE) units += dv.getInt16(at + fieldBytes(format, FIELDS_BEFORE_X_ADVANCE), false);
  if (!(format & VALUE_X_ADVANCE_DEVICE) || !store) return units;
  const deviceOffset = u16(dv, at + fieldBytes(format, FIELDS_BEFORE_X_ADVANCE_DEVICE));
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
  const pairSubtables = kernLookups(table).map((lookup) =>
    (table.lookups[lookup]?.subtables ?? []).filter((subtable) => subtable.type === PAIR_ADJUSTMENT)
  );
  if (pairSubtables.every((subtables) => subtables.length === 0)) return null;
  const store = gdefVariationStore(sfnt, axes.length);
  const { dv } = sfnt;
  return (normalized) => (left, right) => {
    let units = 0;
    for (const subtables of pairSubtables) {
      for (const { offset } of subtables) {
        const records = pairValueRecords(dv, offset, left, right);
        if (!records) continue;
        units += records.reduce((sum, record) => sum + xAdvanceUnits(dv, record, store, normalized), 0);
        break;
      }
    }
    return units;
  };
}
