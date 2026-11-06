/**
 * How a font draws a character it lacks: the marks of its decomposition, each with the offset that
 * the font's `GPOS` mark lookups give it against the base (`canonicalGlyphs.ts`, `markPositioning.ts`),
 * or HarfBuzz's fallback placement where the font has no `GPOS` script (`fallbackMarkPositioning.ts`).
 */

import { recentlyRead } from '../../../../utils/recentlyRead';
import { drawnCharacters } from './canonicalGlyphs';
import { fallbackMarkReader, type SizedClusterOffsets } from './fallbackMarkPositioning';
import { glyphOffsetPx } from './fontMetrics';
import { hasMarkScript, markPositioningReader, ORIGIN } from './markPositioning';
import { sfntMapsGlyph } from './sfntCmap';
import { parseSfntScalars, type SfntFile } from './sfntTables';

/** A mark drawn over a base, and where its origin sits against the base's origin in px with y up, at one font size. */
export interface DrawnMark {
  readonly char: string;
  readonly xPx: number;
  readonly yPx: number;
}

/** A character drawn as a base and the marks over it. */
export interface DecomposedGlyph {
  readonly base: string;
  readonly marks: readonly DrawnMark[];
}

/**
 * How `ch` draws as a base and marks at `fontSizePx`, or null for a character the font draws as one
 * glyph or not at all.
 */
export type Decomposition = (ch: string, fontSizePx: number) => DecomposedGlyph | null;

/** Whether `sfntDecomposition` needs outlines for `sfnt`: the font has no `GPOS` script for marks. */
export const usesFallbackMarks = (sfnt: SfntFile): boolean => !hasMarkScript(sfnt);

function fallbackMarkReaderOf(openOutlines: () => SfntFile | null): SizedClusterOffsets | null {
  const outlines = openOutlines();
  return outlines && fallbackMarkReader(outlines);
}

/** The `GPOS` offsets, which are design units, in px at the size asked. */
function gposOffsetReader(sfnt: SfntFile): SizedClusterOffsets | null {
  const offsetsOf = markPositioningReader(sfnt);
  const unitsPerEm = parseSfntScalars(sfnt)?.unitsPerEm;
  if (!offsetsOf || !unitsPerEm) return null;
  // The GPOS walk does not depend on the size, so each cluster is read once.
  const unitOffsets = new Map<string, ReturnType<typeof offsetsOf>>();
  const readUnits = (cluster: readonly string[]) => {
    const key = cluster.join('');
    let offsets = unitOffsets.get(key);
    if (!offsets) unitOffsets.set(key, (offsets = offsetsOf(cluster)));
    return offsets;
  };
  return (cluster, fontSizePx) =>
    readUnits(cluster).map(({ x, y }) => ({
      x: glyphOffsetPx(x, unitsPerEm, fontSizePx),
      y: glyphOffsetPx(y, unitsPerEm, fontSizePx),
    }));
}

/**
 * `openOutlines` opens the font with the tables the fallback placement reads (`glyf` or `CFF `, and
 * `hmtx`). A font with a `GPOS` script never calls it: see `usesFallbackMarks`.
 */
export function sfntDecomposition(
  sfnt: SfntFile,
  openOutlines: () => SfntFile | null = () => sfnt
): Decomposition | null {
  const mapsGlyph = sfntMapsGlyph(sfnt);
  if (!mapsGlyph) return null;
  // Read at the first decomposed character: most fonts never need their `GPOS` or outlines.
  let offsetsOf: SizedClusterOffsets | null | undefined;
  const readOffsets = () =>
    offsetsOf === undefined
      ? (offsetsOf = gposOffsetReader(sfnt) ?? fallbackMarkReaderOf(openOutlines))
      : offsetsOf;
  const keptAtSize = recentlyRead<number, Map<string, DecomposedGlyph | null>>(MAX_KEPT_SIZES);
  return (ch, fontSizePx) => {
    const kept = keptAtSize(fontSizePx, newDecompositionsByCharacter);
    let glyph = kept.get(ch);
    if (glyph === undefined) kept.set(ch, (glyph = decompose(ch, fontSizePx, mapsGlyph, readOffsets)));
    return glyph;
  };
}

/** Declared once, not inline: an arrow inside the reader would allocate a closure on every read. */
const newDecompositionsByCharacter = (): Map<string, DecomposedGlyph | null> => new Map();

/** A font size animation passes through many sizes, so the decompositions of this many sizes are kept. */
const MAX_KEPT_SIZES = 8;

function decompose(
  ch: string,
  fontSizePx: number,
  mapsGlyph: (ch: string) => boolean,
  readOffsets: () => SizedClusterOffsets | null
): DecomposedGlyph | null {
  const drawn = drawnCharacters(ch, mapsGlyph);
  if (!drawn || drawn.length < 2) return null;
  const offsets = readOffsets()?.(drawn, fontSizePx);
  const marks = drawn.slice(1).map((char, i) => {
    const { x, y } = offsets?.[i + 1] ?? ORIGIN;
    return { char, xPx: x, yPx: y };
  });
  return { base: drawn[0]!, marks };
}
