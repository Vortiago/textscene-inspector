/**
 * The side bearings and advances of a TrueType glyph in font units, as FreeType reads them to
 * place the glyph's phantom points (`ttgload.c`, `TT_Get_HMetrics` and `TT_Get_VMetrics`, and
 * `sfnt/ttmtx.c`, `tt_face_get_metrics`). A font with no vertical metrics takes them from the
 * typographic ascender and descender of `OS/2`, or else from `hhea`.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { toInt16, toUint16 } from '../../../../godot/variant/intWidth';
import {
  HHEA_ASCENDER_OFFSET,
  HHEA_DESCENDER_OFFSET,
  OS2_TYPO_ASCENDER_OFFSET,
  OS2_TYPO_DESCENDER_OFFSET,
  readLongMetricCount,
  tableFits,
  type SfntFile,
  type TableRecord,
} from './sfntTables';

/** The length of an `hhea` or `vhea` header through its count of long metrics. */
const METRICS_HEADER_LENGTH = 36;
/** The length of `OS/2` through sTypoDescender. */
const OS2_TYPO_LENGTH = 72;

/** One axis of a glyph's metrics in font units. */
export interface GlyphAxisMetrics {
  readonly bearing: number;
  readonly advance: number;
}

/** The metrics of a glyph past its table, or of a font without the table. */
const NO_AXIS_METRICS: GlyphAxisMetrics = Object.freeze({ bearing: 0, advance: 0 });

/** A glyph's horizontal and vertical metrics, which the phantom points mark. */
export interface GlyphMetrics {
  horizontal: GlyphAxisMetrics;
  vertical: GlyphAxisMetrics;
}

/** `(advance, bearing)` pairs and then bearings alone, as `hmtx` and `vmtx` hold them. */
interface MetricsTable {
  dv: DataView;
  table: TableRecord;
  longMetricCount: number;
}

/**
 * `tt_face_get_metrics`: the glyph's advance and bearing. A glyph past the long metrics takes the
 * last advance, and a read past the table answers zero.
 */
function axisMetrics({ dv, table, longMetricCount }: MetricsTable, glyphIndex: number): GlyphAxisMetrics {
  const end = table.offset + table.length;
  if (longMetricCount === 0) return NO_AXIS_METRICS;
  if (glyphIndex < longMetricCount) {
    const at = table.offset + 4 * glyphIndex;
    if (at + 4 > end) return NO_AXIS_METRICS;
    return { advance: dv.getUint16(at, false), bearing: dv.getInt16(at + 2, false) };
  }
  const lastLong = table.offset + 4 * (longMetricCount - 1);
  if (lastLong + 2 > end) return NO_AXIS_METRICS;
  const bearingAt = lastLong + 4 + 2 * (glyphIndex - longMetricCount);
  return {
    advance: dv.getUint16(lastLong, false),
    bearing: bearingAt + 2 > end ? 0 : dv.getInt16(bearingAt, false),
  };
}

/** The metrics table and the count of long metrics its header gives, or null for a font without the pair. */
function metricsTable({ dv, tables }: SfntFile, headerTag: string, tableTag: string): MetricsTable | null {
  const header = tables.get(headerTag);
  const table = tables.get(tableTag);
  if (!header || !table || !tableFits(dv, header, METRICS_HEADER_LENGTH)) return null;
  return { dv, table, longMetricCount: readLongMetricCount(dv, header) };
}

/** The ascender and descender that stand in for vertical metrics: `OS/2`'s typographic pair, or `hhea`'s. */
function emulatedVerticalExtent({ dv, tables }: SfntFile): { ascender: number; descender: number } {
  const os2 = tables.get('OS/2');
  if (os2 && tableFits(dv, os2, OS2_TYPO_LENGTH))
    return {
      ascender: dv.getInt16(os2.offset + OS2_TYPO_ASCENDER_OFFSET, false),
      descender: dv.getInt16(os2.offset + OS2_TYPO_DESCENDER_OFFSET, false),
    };
  const hhea = tables.get('hhea');
  if (hhea && tableFits(dv, hhea, METRICS_HEADER_LENGTH))
    return {
      ascender: dv.getInt16(hhea.offset + HHEA_ASCENDER_OFFSET, false),
      descender: dv.getInt16(hhea.offset + HHEA_DESCENDER_OFFSET, false),
    };
  return { ascender: 0, descender: 0 };
}

/**
 * The metrics reader of a font: a glyph's metrics, given the top of its bounding box, which the
 * emulated top bearing measures from.
 */
export function glyphMetricsReader(sfnt: SfntFile): (glyphIndex: number, yMax: number) => GlyphMetrics {
  const horizontal = metricsTable(sfnt, 'hhea', 'hmtx');
  const vertical = metricsTable(sfnt, 'vhea', 'vmtx');
  const { ascender, descender } = emulatedVerticalExtent(sfnt);
  return (glyphIndex, yMax) => ({
    horizontal: horizontal ? axisMetrics(horizontal, glyphIndex) : NO_AXIS_METRICS,
    vertical: vertical
      ? axisMetrics(vertical, glyphIndex)
      : { bearing: toInt16(ascender - yMax), advance: toUint16(Math.abs(ascender - descender)) },
  });
}
