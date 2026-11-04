/**
 * The `avar` table (`ttgxvar.c`, `ft_var_load_avar`): piecewise maps from the normalised coordinate
 * of each axis to its adjusted one, and from version 2 an item variation store that adds a delta.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ByteReader, ReadPastEndError } from '../../../../../resources/formats/binaryresource/byteReader';
import { tableFits, type SfntFile } from '../sfntTables';
import { fdot14ToFixed } from './fixedPoint';
import {
  readDeltaSetIndexMap,
  readItemVariationStore,
  type DeltaSetIndexMap,
  type ItemVariationStore,
} from './itemVariationStore';

interface Correspondence {
  readonly from: number;
  readonly to: number;
}

/** The pairs of one axis, `from` and `to` in 16.16, in the order of the table. */
export type AxisSegment = readonly Correspondence[];

export interface AxisVariations {
  /** The segment map of each axis, or null when the table's segments did not load. */
  readonly segments: readonly AxisSegment[] | null;
  /** From version 2: the store that adds a delta to each axis, with its optional map from the axis. */
  readonly store: ItemVariationStore | null;
  readonly axisMap: DeltaSetIndexMap | null;
}

const AVAR_HEADER_SIZE = 8;
const AVAR_VERSION_1 = 0x00010000;
const AVAR_VERSION_2 = 0x00020000;

function readSegments(reader: ByteReader, axisCount: number, tableLength: number): AxisSegment[] | null {
  const segments: AxisSegment[] = [];
  for (let axis = 0; axis < axisCount; axis++) {
    const pairCount = reader.u16();
    if (pairCount * 4 > tableLength) return null;
    segments.push(
      Array.from({ length: pairCount }, () => ({
        from: fdot14ToFixed(reader.i16()),
        to: fdot14ToFixed(reader.i16()),
      }))
    );
  }
  return segments;
}

/**
 * The adjustments of `avar`, or null when the font has none or FreeType ignores the table: a
 * version it does not know, or a count of axes that differs from `fvar`'s. A table that fails
 * half way keeps what FreeType had loaded then.
 */
export function readAvar(sfnt: SfntFile, axisCount: number): AxisVariations | null {
  const { dv } = sfnt;
  const avar = sfnt.tables.get('avar');
  if (!avar || !tableFits(dv, avar, AVAR_HEADER_SIZE)) return null;
  const version = dv.getInt32(avar.offset, false);
  if (version !== AVAR_VERSION_1 && version !== AVAR_VERSION_2) return null;
  if (dv.getInt32(avar.offset + 4, false) !== axisCount) return null;

  const reader = ByteReader.bigEndian(new Uint8Array(dv.buffer, dv.byteOffset + avar.offset, avar.length));
  reader.seek(AVAR_HEADER_SIZE);
  try {
    const segments = readSegments(reader, axisCount, avar.length);
    if (!segments || version === AVAR_VERSION_1) return { segments, store: null, axisMap: null };

    const axisMapOffset = reader.u32();
    const storeOffset = reader.u32();
    const store = storeOffset ? readItemVariationStore(dv, avar.offset + storeOffset, axisCount) : null;
    if (storeOffset && !store) return { segments, store: null, axisMap: null };
    const axisMap =
      axisMapOffset && store
        ? readDeltaSetIndexMap(dv, avar.offset + axisMapOffset, avar.length, store)
        : null;
    return { segments, store, axisMap };
  } catch (error) {
    if (error instanceof ReadPastEndError || error instanceof RangeError)
      return { segments: null, store: null, axisMap: null };
    throw error;
  }
}
