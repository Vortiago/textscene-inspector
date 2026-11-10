/**
 * Where the marks of a shaped cluster sit against its base in a font: at the offset the font's
 * `GPOS` mark lookups give each (`markPositioning.ts`), or by HarfBuzz's fallback placement where
 * the font has no `GPOS` script (`fallbackMarkPositioning.ts`).
 */

import type { LookupGlyph } from './autofit/openTypeGdef';
import { fallbackMarkReader, type SizedClusterOffsets } from './fallbackMarkPositioning';
import { glyphOffsetPx } from './fontMetrics';
import { markPositioningReader, ORIGIN, type MarkOffset } from './markPositioning';
import { parseSfntScalars, type SfntFile } from './sfntTables';
import { recentlyRead } from '../../../../utils/recentlyRead';

function fallbackMarkReaderOf(openOutlines: () => SfntFile | null): SizedClusterOffsets | null {
  const outlines = openOutlines();
  return outlines && fallbackMarkReader(outlines);
}

/** A key for a cluster's glyphs: the offsets depend on the glyphs alone, and the fallback on their characters. */
const clusterKey = (cluster: readonly LookupGlyph[]): string =>
  cluster.map(({ glyph, codePoint }) => `${glyph}:${codePoint}`).join(' ');

/** The `GPOS` offsets, which are design units, in px at the size asked. */
function gposOffsetReader(sfnt: SfntFile): SizedClusterOffsets | null {
  const offsetsOf = markPositioningReader(sfnt);
  const unitsPerEm = parseSfntScalars(sfnt)?.unitsPerEm;
  if (!offsetsOf || !unitsPerEm) return null;
  // The GPOS walk does not depend on the size, so each cluster is read once.
  const unitOffsets = new Map<string, readonly MarkOffset[]>();
  const readUnits = (cluster: readonly LookupGlyph[]) => {
    const key = clusterKey(cluster);
    let offsets = unitOffsets.get(key);
    if (!offsets) keep(unitOffsets, key, (offsets = offsetsOf(cluster)));
    return offsets;
  };
  return (cluster, fontSizePx) =>
    readUnits(cluster).map(({ x, y }) => ({
      x: glyphOffsetPx(x, unitsPerEm, fontSizePx),
      y: glyphOffsetPx(y, unitsPerEm, fontSizePx),
    }));
}

/**
 * The mark offsets of `sfnt` in px, y up, for a cluster of a base and its marks. `openOutlines` opens
 * the font with the tables the fallback placement reads (`glyf` or `CFF `, and `hmtx`). A font with a
 * `GPOS` script for its marks never calls it, and a font with neither answers each mark at the base's origin.
 */
export function sfntMarkOffsets(
  sfnt: SfntFile,
  openOutlines: () => SfntFile | null = () => sfnt
): SizedClusterOffsets {
  // Read at the first cluster with a mark: most text never needs the `GPOS` or the outlines.
  let offsetsOf: SizedClusterOffsets | null | undefined;
  const readOffsets = () =>
    offsetsOf === undefined
      ? (offsetsOf = gposOffsetReader(sfnt) ?? fallbackMarkReaderOf(openOutlines))
      : offsetsOf;
  const keptAtSize = recentlyRead<number, Map<string, readonly MarkOffset[]>>(MAX_KEPT_SIZES);
  return (cluster, fontSizePx) => {
    if (cluster.length < 2) return BASE_ALONE;
    const kept = keptAtSize(fontSizePx, newOffsetsByCluster);
    const key = clusterKey(cluster);
    let offsets = kept.get(key);
    if (offsets === undefined) {
      offsets = readOffsets()?.(cluster, fontSizePx) ?? cluster.map(() => ORIGIN);
      keep(kept, key, offsets);
    }
    return offsets;
  };
}

/** The offsets of a cluster with no mark: its base sits at its own origin. */
const BASE_ALONE: readonly MarkOffset[] = [ORIGIN];

/** Declared once, not inline: an arrow inside the reader would allocate a closure on every read. */
const newOffsetsByCluster = (): Map<string, readonly MarkOffset[]> => new Map();

/** A font size animation passes through many sizes, so the offsets of this many sizes are kept. */
const MAX_KEPT_SIZES = 8;

/** A long edit session shapes ever new clusters, so a cache drops all it holds past this many. */
const MAX_KEPT_CLUSTERS = 4096;

/** Sets `key` in `offsetsByCluster`, emptied first once it holds `MAX_KEPT_CLUSTERS` clusters. */
function keep(
  offsetsByCluster: Map<string, readonly MarkOffset[]>,
  key: string,
  offsets: readonly MarkOffset[]
): void {
  if (offsetsByCluster.size >= MAX_KEPT_CLUSTERS) offsetsByCluster.clear();
  offsetsByCluster.set(key, offsets);
}
