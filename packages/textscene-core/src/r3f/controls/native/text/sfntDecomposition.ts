/**
 * How a font draws a cluster of a base and marks, or a character it lacks: the characters HarfBuzz's
 * normalisation gives it (`canonicalGlyphs.ts`), each mark with the offset that the font's `GPOS`
 * mark lookups give it against the base (`markPositioning.ts`), or HarfBuzz's fallback placement
 * where the font has no `GPOS` script (`fallbackMarkPositioning.ts`).
 */

import { recentlyRead } from '../../../../utils/recentlyRead';
import { normalisedCharacters } from './canonicalGlyphs';
import { fallbackMarkReader, type SizedClusterOffsets } from './fallbackMarkPositioning';
import { glyphOffsetPx } from './fontMetrics';
import { markPositioningReader, ORIGIN, type MarkOffset } from './markPositioning';
import { sfntMapsGlyph } from './sfntCmap';
import { parseSfntScalars, type SfntFile } from './sfntTables';

/** A mark drawn over a base, and where its origin sits against the base's origin in px with y up, at one font size. */
export interface DrawnMark extends MarkOffset {
  readonly char: string;
}

/** A cluster drawn as a base and the marks over it. A cluster that composes into one character has no marks. */
export interface DecomposedGlyph {
  readonly base: string;
  readonly marks: readonly DrawnMark[];
}

/**
 * How `cluster`, a character or a base and its marks, draws at `fontSizePx`: as another character,
 * or as a base and marks. Null for a cluster of one character that the font draws as itself, and for
 * one the font cannot draw.
 */
export type Decomposition = (cluster: string, fontSizePx: number) => DecomposedGlyph | null;

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
 * `hmtx`). A font with a `GPOS` script for its marks never calls it.
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
  return (cluster, fontSizePx) => {
    const kept = keptAtSize(fontSizePx, newDecompositionsByCluster);
    let glyph = kept.get(cluster);
    if (glyph === undefined)
      kept.set(cluster, (glyph = decompose(cluster, fontSizePx, mapsGlyph, readOffsets)));
    return glyph;
  };
}

/** Declared once, not inline: an arrow inside the reader would allocate a closure on every read. */
const newDecompositionsByCluster = (): Map<string, DecomposedGlyph | null> => new Map();

/** A font size animation passes through many sizes, so the decompositions of this many sizes are kept. */
const MAX_KEPT_SIZES = 8;

/** How `cluster` draws at `fontSizePx` in a font that maps the characters `mapsGlyph` accepts. */
function decompose(
  cluster: string,
  fontSizePx: number,
  mapsGlyph: (ch: string) => boolean,
  readOffsets: () => SizedClusterOffsets | null
): DecomposedGlyph | null {
  const drawn = normalisedCharacters(cluster, mapsGlyph);
  if (!drawn || (drawn.length === 1 && drawn[0] === cluster)) return null;
  if (drawn.length === 1) return { base: drawn[0]!, marks: [] };
  const offsets = readOffsets()?.(drawn, fontSizePx);
  const marks = drawn.slice(1).map((char, i) => {
    const { x, y } = offsets?.[i + 1] ?? ORIGIN;
    return { char, x, y };
  });
  return { base: drawn[0]!, marks };
}
