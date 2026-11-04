/**
 * The item variation store that `avar` 2, `HVAR` and `VVAR` hold, and the delta-set index map that
 * leads a glyph or an axis to its item (`ttgxvar.c`, `tt_var_load_item_variation_store`,
 * `tt_var_load_delta_set_index_mapping` and `tt_var_get_item_delta`). A table that FreeType refuses
 * reads as null.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ByteReader, ReadPastEndError } from '../../../../../resources/formats/binaryresource/byteReader';
import { ftMulDiv } from '../fontMetrics';
import { fdot14ToFixed } from './fixedPoint';

/** The three coordinates of a region on one axis, in 16.16. */
interface AxisRegion {
  readonly start: number;
  readonly peak: number;
  readonly end: number;
}

interface ItemVariationData {
  readonly itemCount: number;
  readonly regionIndices: readonly number[];
  readonly wordDeltaCount: number;
  readonly hasLongWords: boolean;
  readonly deltaSets: Uint8Array;
}

export interface ItemVariationStore {
  readonly axisCount: number;
  readonly regions: readonly (readonly AxisRegion[])[];
  readonly data: readonly ItemVariationData[];
}

/** The index pair that tells a missing item: OpenType 1.8.4 gives it no variation data. */
const NO_VARIATION_INDEX = 0xffff;
/** `new constraint in OpenType 1.8.4`: a region list at or above this is invalid. */
const REGION_COUNT_LIMIT = 32768;
const REGION_RECORD_SIZE = 6;
const MAP_ENTRY_NO_VARIATION = 0xffffffff;

function bytesOf(dv: DataView, offset: number): ByteReader | null {
  if (offset < 0 || offset > dv.byteLength) return null;
  const reader = ByteReader.bigEndian(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength));
  reader.seek(offset);
  return reader;
}

function readRegions(reader: ByteReader, axisCount: number, regionCount: number): AxisRegion[][] | null {
  if (regionCount >= REGION_COUNT_LIMIT) return null;
  if (regionCount * axisCount * REGION_RECORD_SIZE > reader.remaining) return null;
  return Array.from({ length: regionCount }, () =>
    Array.from({ length: axisCount }, () => {
      const start = reader.i16();
      let peak = reader.i16();
      const end = reader.i16();
      // An invalid range is tagged with a peak of 0, which the scalar skips.
      if ((start < 0 && end > 0) || start > peak || peak > end) peak = 0;
      return { start: fdot14ToFixed(start), peak: fdot14ToFixed(peak), end: fdot14ToFixed(end) };
    })
  );
}

function readItemVariationData(reader: ByteReader, regionCount: number): ItemVariationData | null {
  const itemCount = reader.u16();
  const wordCountField = reader.u16();
  const regionIndexCount = reader.u16();
  const hasLongWords = (wordCountField & 0x8000) !== 0;
  const wordDeltaCount = wordCountField & 0x7fff;
  if (wordDeltaCount > regionIndexCount || regionIndexCount > regionCount) return null;
  if (regionIndexCount * 2 > reader.remaining) return null;
  const regionIndices = Array.from({ length: regionIndexCount }, () => reader.u16());
  if (regionIndices.some((index) => index >= regionCount)) return null;
  const bytesPerItem = (wordDeltaCount + regionIndexCount) * (hasLongWords ? 2 : 1);
  if (itemCount * bytesPerItem > reader.remaining) return null;
  return {
    itemCount,
    regionIndices,
    wordDeltaCount,
    hasLongWords,
    deltaSets: reader.take(itemCount * bytesPerItem),
  };
}

/**
 * The store at `offset` of `dv`, or null when FreeType refuses it: a format other than 1, no data,
 * a region list whose axes differ from the font's, or an item or index that does not fit.
 */
export function readItemVariationStore(
  dv: DataView,
  offset: number,
  axisCount: number
): ItemVariationStore | null {
  const reader = bytesOf(dv, offset);
  if (!reader) return null;
  try {
    if (reader.u16() !== 1) return null;
    const regionOffset = reader.u32();
    const dataCount = reader.u16();
    if (dataCount === 0) return null;
    const dataOffsets = Array.from({ length: dataCount }, () => reader.u32());

    reader.seek(offset + regionOffset);
    if (reader.u16() !== axisCount) return null;
    const regions = readRegions(reader, axisCount, reader.u16());
    if (!regions) return null;

    const data: ItemVariationData[] = [];
    for (const dataOffset of dataOffsets) {
      reader.seek(offset + dataOffset);
      const variationData = readItemVariationData(reader, regions.length);
      if (!variationData) return null;
      data.push(variationData);
    }
    return { axisCount, regions, data };
  } catch (error) {
    if (error instanceof ReadPastEndError || error instanceof RangeError) return null;
    throw error;
  }
}

/** `tt_calculate_scalar`: how much of its deltas a region gives the coordinates, in 16.16. */
function regionScalar(region: readonly AxisRegion[], normalized: Int32Array): number {
  let scalar = 0x10000;
  for (let axis = 0; axis < region.length; axis++) {
    const { start, peak, end } = region[axis]!;
    const coordinate = normalized[axis] ?? 0;
    if (peak === coordinate || peak === 0) continue;
    if (coordinate <= start || coordinate >= end) return 0;
    scalar =
      coordinate < peak
        ? ftMulDiv(scalar, coordinate - start, peak - start)
        : ftMulDiv(scalar, end - coordinate, end - peak);
  }
  return scalar;
}

/** The delta of one item at the normalised coordinates (`tt_var_get_item_delta`), 0 for an item out of range. */
export function itemDelta(
  store: ItemVariationStore,
  outerIndex: number,
  innerIndex: number,
  normalized: Int32Array
): number {
  if (outerIndex === NO_VARIATION_INDEX && innerIndex === NO_VARIATION_INDEX) return 0;
  const data = store.data[outerIndex];
  if (!data || innerIndex >= data.itemCount || data.regionIndices.length === 0) return 0;

  const bytesPerDelta = data.hasLongWords ? 2 : 1;
  const itemSize = (data.wordDeltaCount + data.regionIndices.length) * bytesPerDelta;
  const view = new DataView(data.deltaSets.buffer, data.deltaSets.byteOffset, data.deltaSets.byteLength);
  let at = itemSize * innerIndex;
  let sum = 0;
  data.regionIndices.forEach((regionIndex, master) => {
    const isWord = master < data.wordDeltaCount;
    const width = (isWord ? 2 : 1) * bytesPerDelta;
    const scalar = regionScalar(store.regions[regionIndex]!, normalized);
    if (scalar !== 0) sum += readDelta(view, at, width) * scalar;
    at += width;
  });
  return Math.floor((sum + 0x8000) / 0x10000);
}

/** A signed big-endian delta of 1, 2 or 4 bytes. */
function readDelta(view: DataView, at: number, width: number): number {
  if (width === 1) return view.getInt8(at);
  return width === 2 ? view.getInt16(at, false) : view.getInt32(at, false);
}

/** The item each index leads to (`GX_DeltaSetIdxMapRec`). */
export interface DeltaSetIndexMap {
  readonly outerIndices: Uint16Array;
  readonly innerIndices: Uint16Array;
}

/**
 * The delta-set index map at `offset` of `dv`, or null when FreeType refuses it, which checks every
 * entry against `store`. `tableLength` bounds the entry count, as FreeType's sanity check does.
 */
export function readDeltaSetIndexMap(
  dv: DataView,
  offset: number,
  tableLength: number,
  store: ItemVariationStore
): DeltaSetIndexMap | null {
  const reader = bytesOf(dv, offset);
  if (!reader) return null;
  try {
    const format = reader.u8();
    const entryFormat = reader.u8();
    if (format > 1) return null;
    const mapCount = format === 0 ? reader.u16() : reader.u32();
    if (entryFormat & 0xc0) return null;
    const entrySize = ((entryFormat & 0x30) >> 4) + 1;
    const innerBitCount = (entryFormat & 0x0f) + 1;
    if (mapCount * entrySize > tableLength || mapCount * entrySize > reader.remaining) return null;

    const outerIndices = new Uint16Array(mapCount);
    const innerIndices = new Uint16Array(mapCount);
    for (let index = 0; index < mapCount; index++) {
      let entry = 0;
      for (let byte = 0; byte < entrySize; byte++) entry = entry * 256 + reader.u8();
      if (entry === MAP_ENTRY_NO_VARIATION) {
        outerIndices[index] = NO_VARIATION_INDEX;
        innerIndices[index] = NO_VARIATION_INDEX;
        continue;
      }
      const outer = Math.floor(entry / 2 ** innerBitCount);
      const inner = entry % 2 ** innerBitCount;
      if (outer >= store.data.length || inner >= store.data[outer]!.itemCount) return null;
      outerIndices[index] = outer;
      innerIndices[index] = inner;
    }
    return { outerIndices, innerIndices };
  } catch (error) {
    if (error instanceof ReadPastEndError || error instanceof RangeError) return null;
    throw error;
  }
}

/**
 * The item of `index` through an optional map: the map's last entry stands for an index past its
 * end, and no map, or an empty one, means the index itself, as the inner one.
 */
export function mappedItem(map: DeltaSetIndexMap | null, index: number): readonly [number, number] {
  if (!map || map.innerIndices.length === 0) return [0, index];
  const entry = Math.min(index, map.innerIndices.length - 1);
  return [map.outerIndices[entry]!, map.innerIndices[entry]!];
}
