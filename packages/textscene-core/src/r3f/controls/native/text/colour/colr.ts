/**
 * The colour layers of a glyph in a font's `COLR` table, version 0, as FreeType reads them for
 * `FT_LOAD_COLOR` (`ttcolr.c`, `tt_face_load_colr` and `tt_face_get_colr_layer`). Each layer is a
 * glyph of the font and the colour of its palette entry. FreeType paints no version 1 graph for a
 * load: a glyph with only a paint graph draws its own outline (`ftobjs.c:4743-4810`).
 *
 * Portions ported from FreeType (FreeType License).
 * Copyright (c) 1996-2024 David Turner, Robert Wilhelm and Werner Lemberg.
 */
import { readGlyphCount, type SfntFile } from '../sfntTables';
import type { BgraColour, Palette } from './cpal';

export interface ColrLayer {
  readonly glyph: number;
  readonly colour: BgraColour;
}

/** The layers of a glyph, or null for a glyph `COLR` gives none, which draws its own outline. */
export type ColrLayersReader = (glyph: number) => readonly ColrLayer[] | null;

/** version(2) numBaseGlyphRecords(2) baseGlyphRecordsOffset(4) layerRecordsOffset(4) numLayerRecords(2). */
const COLRV0_HEADER_SIZE = 14;
/** The version 0 header, then baseGlyphListOffset(4) layerListOffset(4) clipListOffset(4) varIndexMapOffset(4) itemVariationStoreOffset(4). */
const COLRV1_HEADER_SIZE = 34;
/** glyphID(2) firstLayerIndex(2) numLayers(2). */
const BASE_GLYPH_SIZE = 6;
/** glyphID(2) paletteIndex(2). */
const LAYER_SIZE = 4;
/** glyphID(2) paintOffset(4). */
const BASE_GLYPH_PAINT_RECORD_SIZE = 6;
/** paintOffset(4). */
const LAYER_V1_LIST_PAINT_OFFSET_SIZE = 4;
/** The palette index that names the foreground colour. */
const FOREGROUND_INDEX = 0xffff;
const OPAQUE_WHITE: BgraColour = [0xff, 0xff, 0xff, 0xff];
const OPAQUE_BLACK: BgraColour = [0, 0, 0, 0xff];

interface ColrTable {
  readonly baseGlyphsAt: number;
  readonly baseGlyphCount: number;
  readonly layersAt: number;
  readonly layerCount: number;
}

/**
 * The reader of each glyph's layers in palette 0 of `palette`, or null for a font with no `COLR`
 * and for one FreeType rejects. The palette must be the font's own `CPAL`, which FreeType needs
 * before it reads `COLR`.
 */
export function colrLayersReader(sfnt: SfntFile, palette: Palette): ColrLayersReader | null {
  const colr = readColr(sfnt);
  if (!colr) return null;
  const glyphCount = readGlyphCount(sfnt) ?? 0;
  // FreeType sets no foreground colour for Godot, so the foreground is the palette's default.
  const foreground = palette.isForDarkBackground ? OPAQUE_WHITE : OPAQUE_BLACK;
  const { dv } = sfnt;
  return (glyph) => {
    const record = findBaseGlyphRecord(dv, colr, glyph);
    if (!record || record.layerCount === 0) return null;
    if (record.firstLayer + record.layerCount > colr.layerCount) return null;
    const layers: ColrLayer[] = [];
    for (let index = 0; index < record.layerCount; index++) {
      const at = colr.layersAt + (record.firstLayer + index) * LAYER_SIZE;
      const layerGlyph = dv.getUint16(at);
      const paletteIndex = dv.getUint16(at + 2);
      // FreeType ends the layers at the first that names no glyph or no palette entry.
      if (layerGlyph >= glyphCount) break;
      if (paletteIndex !== FOREGROUND_INDEX && paletteIndex >= palette.entries.length) break;
      const colour = paletteIndex === FOREGROUND_INDEX ? foreground : palette.entries[paletteIndex]!;
      layers.push({ glyph: layerGlyph, colour });
    }
    return layers.length > 0 ? layers : null;
  };
}

/** The `COLR` header, or null where FreeType rejects the table. */
function readColr({ dv, tables }: SfntFile): ColrTable | null {
  const table = tables.get('COLR');
  if (!table || table.length < COLRV0_HEADER_SIZE || table.offset + table.length > dv.byteLength) return null;
  const { offset, length } = table;
  const version = dv.getUint16(offset);
  if (version !== 0 && version !== 1) return null;
  const baseGlyphCount = dv.getUint16(offset + 2);
  const baseGlyphsOffset = dv.getUint32(offset + 4);
  const layersOffset = dv.getUint32(offset + 8);
  const layerCount = dv.getUint16(offset + 12);
  if (
    length <= baseGlyphsOffset ||
    Math.floor((length - baseGlyphsOffset) / BASE_GLYPH_SIZE) < baseGlyphCount
  )
    return null;
  if (length <= layersOffset || Math.floor((length - layersOffset) / LAYER_SIZE) < layerCount) return null;
  if (version === 1 && !colrV1HeaderFits(dv, offset, length, tables.has('fvar'))) return null;
  return {
    baseGlyphsAt: offset + baseGlyphsOffset,
    baseGlyphCount,
    layersAt: offset + layersOffset,
    layerCount,
  };
}

/**
 * Whether the version 1 lists fit the table as FreeType checks them. A version 1 table that fails
 * loses its version 0 layers too. Of the variation store a variable font points at, the offsets
 * are checked, and not the store itself.
 */
function colrV1HeaderFits(dv: DataView, offset: number, length: number, isVariable: boolean): boolean {
  if (length < COLRV1_HEADER_SIZE) return false;
  const baseGlyphListOffset = dv.getUint32(offset + 14);
  if (length - 4 <= baseGlyphListOffset) return false;
  const paintRecordCount = dv.getUint32(offset + baseGlyphListOffset);
  if (Math.floor((length - baseGlyphListOffset - 4) / BASE_GLYPH_PAINT_RECORD_SIZE) < paintRecordCount)
    return false;
  const layerListOffset = dv.getUint32(offset + 18);
  if (length <= layerListOffset) return false;
  if (layerListOffset !== 0) {
    if (length - 4 <= layerListOffset) return false;
    const paintCount = dv.getUint32(offset + layerListOffset);
    if (Math.floor((length - layerListOffset) / LAYER_V1_LIST_PAINT_OFFSET_SIZE) < paintCount) return false;
  }
  const clipListOffset = dv.getUint32(offset + 22);
  if (clipListOffset >= length) return false;
  if (!isVariable) return true;
  return dv.getUint32(offset + 26) < length && dv.getUint32(offset + 30) < length;
}

/** `find_base_glyph_record`: the binary search of the base glyph records, sorted by glyph. */
function findBaseGlyphRecord(
  dv: DataView,
  colr: ColrTable,
  glyph: number
): { firstLayer: number; layerCount: number } | null {
  let min = 0;
  let max = colr.baseGlyphCount;
  while (min < max) {
    const mid = min + Math.floor((max - min) / 2);
    const at = colr.baseGlyphsAt + mid * BASE_GLYPH_SIZE;
    const recordGlyph = dv.getUint16(at);
    if (recordGlyph < glyph) min = mid + 1;
    else if (recordGlyph > glyph) max = mid;
    else return { firstLayer: dv.getUint16(at + 2), layerCount: dv.getUint16(at + 4) };
  }
  return null;
}
