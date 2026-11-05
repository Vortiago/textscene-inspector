/**
 * A variable font at one instance, as FreeType holds it after `FT_Set_Var_Design_Coordinates`: the
 * normalised coordinates, the glyph variations, the control values that `cvar` varies and the
 * advances that `HVAR` and `VVAR` adjust. A font without `fvar` and an instance whose coordinates
 * are all at the default have none, as FreeType draws them at the default.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { perObject } from '../../../../../utils/perObject';
import { opentypeKey, type OpentypeCoordinates } from '../fontMetrics';
import { tableFits, type SfntFile } from '../sfntTables';
import { controlValuesOf } from '../truetype/trueTypeHinting';
import { designCoordinates, normalizedCoordinates } from './axisCoordinates';
import { readAvar, type AxisVariations } from './avar';
import { variedControlValues } from './cvar';
import { readFvarAxes, type FvarAxis } from './fvar';
import { readGlyphVariations, type AdjustedAdvances, type GlyphVariations } from './gvar';
import {
  itemDelta,
  mappedItem,
  readDeltaSetIndexMap,
  readItemVariationStore,
  type DeltaSetIndexMap,
  type ItemVariationStore,
} from './itemVariationStore';
import { InvalidTupleVariationsError } from './tupleVariations';

/** The advance adjustments of `HVAR` or `VVAR`: the store, and the map from a glyph to its item. */
interface AdvanceVariations {
  readonly store: ItemVariationStore;
  readonly widthMap: DeltaSetIndexMap | null;
}

export interface FontInstance {
  /** Names the instance for a cache: its normalised coordinates, the same for two dictionaries that draw alike. */
  readonly key: string;
  /** The coordinate of each axis in 16.16, between -1 and 1. */
  readonly normalized: Int32Array;
  /** The `gvar` deltas, or null for a font without them. */
  readonly glyphVariations: GlyphVariations | null;
  /** The `cvt ` entries in 26.6 once `cvar` has varied them, or null when they stay as the font has them. */
  readonly controlValues: Int32Array | null;
  /** Which advances `HVAR` and `VVAR` adjust, so `gvar` leaves their phantom points alone. */
  readonly adjustedAdvances: AdjustedAdvances;
  /** `tt_hadvance_adjust` and `tt_vadvance_adjust`: the font units that the instance adds to a glyph's advance. */
  readonly advanceDelta: { horizontal(glyphIndex: number): number; vertical(glyphIndex: number): number };
}

/** What a font holds of variation, which every instance of it reads. */
interface VariationFace {
  readonly axes: readonly FvarAxis[];
  readonly avar: AxisVariations | null;
  readonly glyphVariations: GlyphVariations | null | 'invalid';
  readonly horizontal: AdvanceVariations | null;
  readonly vertical: AdvanceVariations | null;
}

const HVAR_HEADER_SIZE = 12;

/** `ft_var_load_hvvar`: the table `tag`, or null when there is none or FreeType refuses it. */
function readAdvanceVariations(sfnt: SfntFile, tag: string, axisCount: number): AdvanceVariations | null {
  const { dv } = sfnt;
  const table = sfnt.tables.get(tag);
  if (!table || !tableFits(dv, table, HVAR_HEADER_SIZE) || dv.getUint16(table.offset, false) !== 1)
    return null;
  const store = readItemVariationStore(dv, table.offset + dv.getUint32(table.offset + 4, false), axisCount);
  if (!store) return null;
  const widthMapOffset = dv.getUint32(table.offset + 8, false);
  if (widthMapOffset === 0) return { store, widthMap: null };
  const widthMap = readDeltaSetIndexMap(dv, table.offset + widthMapOffset, table.length, store);
  return widthMap && { store, widthMap };
}

/** The variation data of the font, once for each font, or null for a font FreeType does not take for a variation font. */
const variationFaceOf = perObject((sfnt: SfntFile): VariationFace | null => {
  const axes = readFvarAxes(sfnt);
  if (!axes) return null;
  return {
    axes,
    avar: readAvar(sfnt, axes.length),
    glyphVariations: readGlyphVariations(sfnt, axes.length),
    horizontal: readAdvanceVariations(sfnt, 'HVAR', axes.length),
    // A font without vertical metrics never asks for a vertical advance, so FreeType never loads `VVAR`.
    vertical:
      sfnt.tables.has('vmtx') && sfnt.tables.has('vhea')
        ? readAdvanceVariations(sfnt, 'VVAR', axes.length)
        : null,
  };
});

function advanceDeltaOf(
  variations: AdvanceVariations | null,
  normalized: Int32Array
): (glyphIndex: number) => number {
  if (!variations) return () => 0;
  return (glyphIndex) => {
    const [outer, inner] = mappedItem(variations.widthMap, glyphIndex);
    return itemDelta(variations.store, outer, inner, normalized);
  };
}

/** The instance of cached values by font, then by axis values. */
const instancesOf = perObject(() => new Map<string, FontInstance | null>());

/**
 * The font drawn at the axis values of `opentype` as Godot sets them, or null when FreeType draws
 * the default: a font without variation axes, one whose `gvar` it refuses, and coordinates that
 * are all at the default.
 */
export function fontInstanceOf(sfnt: SfntFile, opentype: OpentypeCoordinates): FontInstance | null {
  const key = opentypeKey(opentype);
  const instances = instancesOf(sfnt);
  if (!instances.has(key)) instances.set(key, buildInstance(sfnt, opentype));
  return instances.get(key)!;
}

function buildInstance(sfnt: SfntFile, opentype: OpentypeCoordinates): FontInstance | null {
  const face = variationFaceOf(sfnt);
  if (!face || face.glyphVariations === 'invalid') return null;
  const normalized = normalizedCoordinates(face.axes, designCoordinates(face.axes, opentype), face.avar);
  if (normalized.every((coordinate) => coordinate === 0)) return null;

  let controlValues: Int32Array | null;
  try {
    controlValues = variedControlValues(
      sfnt,
      controlValuesOf(sfnt),
      face.axes.length,
      face.glyphVariations?.sharedTuples ?? new Int32Array(0),
      normalized
    );
  } catch (error) {
    if (error instanceof InvalidTupleVariationsError) return null;
    throw error;
  }
  return {
    key: normalized.join(','),
    normalized,
    glyphVariations: face.glyphVariations,
    controlValues,
    adjustedAdvances: { horizontal: face.horizontal !== null, vertical: face.vertical !== null },
    advanceDelta: {
      horizontal: advanceDeltaOf(face.horizontal, normalized),
      vertical: advanceDeltaOf(face.vertical, normalized),
    },
  };
}
