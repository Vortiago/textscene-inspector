/**
 * The default palette of a font's `CPAL` table, as FreeType loads it for the colour layers of `COLR`
 * (`ttcpal.c`, `tt_face_load_cpal` and `tt_face_palette_set`): palette 0, which Godot never changes.
 *
 * Portions ported from FreeType (FreeType License).
 * Copyright (c) 1996-2024 David Turner, Robert Wilhelm and Werner Lemberg.
 */
import type { SfntFile } from '../sfntTables';

/** A colour as FreeType's `FT_Color` holds it: blue, green, red and alpha, each 0-255. */
export type BgraColour = readonly [blue: number, green: number, red: number, alpha: number];

export interface Palette {
  /** The colours of palette 0, by palette entry index. */
  readonly entries: readonly BgraColour[];
  /** `FT_PALETTE_FOR_DARK_BACKGROUND` in the flags of palette 0, which makes the foreground white. */
  readonly isForDarkBackground: boolean;
}

/** version(2) numPaletteEntries(2) numPalettes(2) numColorRecords(2) colorRecordsArrayOffset(4). */
const CPAL_V0_HEADER_BASE_SIZE = 12;
/** paletteTypesArrayOffset(4) paletteLabelsArrayOffset(4) paletteEntryLabelsArrayOffset(4) after the indices. */
const CPAL_V1_OFFSETS_SIZE = 12;
const COLOR_SIZE = 4;
const PALETTE_FOR_DARK_BACKGROUND = 0x0002;

/**
 * Palette 0 of `CPAL`, or null for a font with no `CPAL` and for one FreeType rejects: a version past
 * 1, an offset past the table, more entries than colour records, or a palette whose first record
 * leaves too few. A font whose `CPAL` FreeType rejects draws no `COLR` layer.
 */
export function readCpal({ dv, tables }: SfntFile): Palette | null {
  const table = tables.get('CPAL');
  if (!table || table.length < CPAL_V0_HEADER_BASE_SIZE || table.offset + table.length > dv.byteLength)
    return null;
  const { offset, length } = table;
  const version = dv.getUint16(offset);
  const entryCount = dv.getUint16(offset + 2);
  const paletteCount = dv.getUint16(offset + 4);
  const colourCount = dv.getUint16(offset + 6);
  const coloursOffset = dv.getUint32(offset + 8);
  if (version > 1) return null;
  if (CPAL_V0_HEADER_BASE_SIZE + paletteCount * 2 > length) return null;
  if (coloursOffset >= length || colourCount * COLOR_SIZE > length - coloursOffset) return null;
  if (entryCount > colourCount) return null;
  if (version === 1 && !paletteArraysFit(dv, offset, length, paletteCount, entryCount)) return null;
  // `tt_face_palette_set` fails for no palette, which FreeType counts as a broken table.
  if (paletteCount === 0) return null;

  const firstColour = dv.getUint16(offset + CPAL_V0_HEADER_BASE_SIZE);
  if (firstColour + entryCount > colourCount) return null;
  const entries = Array.from({ length: entryCount }, (_, entry): BgraColour => {
    const at = offset + coloursOffset + (firstColour + entry) * COLOR_SIZE;
    return [dv.getUint8(at), dv.getUint8(at + 1), dv.getUint8(at + 2), dv.getUint8(at + 3)];
  });
  return { entries, isForDarkBackground: paletteFlags(dv, offset, version, paletteCount) };
}

/** Whether the three arrays a version 1 table points at fit the table, as FreeType checks each one. */
function paletteArraysFit(
  dv: DataView,
  offset: number,
  length: number,
  paletteCount: number,
  entryCount: number
): boolean {
  const offsetsAt = CPAL_V0_HEADER_BASE_SIZE + paletteCount * 2;
  if (offsetsAt + CPAL_V1_OFFSETS_SIZE > length) return false;
  const arrayLengths = [paletteCount * 2, paletteCount * 2, entryCount * 2];
  return arrayLengths.every((arrayLength, index) => {
    const arrayOffset = dv.getUint32(offset + offsetsAt + index * 4);
    return arrayOffset === 0 || (arrayOffset < length && arrayLength <= length - arrayOffset);
  });
}

/** Whether a version 1 table flags palette 0 for a dark background. Version 0 holds no flags. */
function paletteFlags(dv: DataView, offset: number, version: number, paletteCount: number): boolean {
  if (version === 0) return false;
  const typesOffset = dv.getUint32(offset + CPAL_V0_HEADER_BASE_SIZE + paletteCount * 2);
  if (typesOffset === 0) return false;
  return (dv.getUint16(offset + typesOffset) & PALETTE_FOR_DARK_BACKGROUND) !== 0;
}
