import type { PlacedCell } from '../nodes/2d/tiles/shared/tileData';
import type { AtlasSourceModel, TileSetModel } from '../resources/tileset/tileSetModel';

/**
 * Where one atlas source's batched mesh sits inside a tile layer's draw
 * position.
 *
 * Godot interleaves a layer's cells across atlas sources in scan order; we
 * batch one mesh per source, so the sources need a deterministic order among
 * themselves. That order is a nudge, not a draw position of its own — it has to
 * fit in the band between this layer's position and whatever draws next, or the
 * layer's tiles overtake the row in front of them.
 *
 * A FIXED nudge cannot promise that. The band narrows as a scene grows: a
 * y-sorted layer decomposes into one draw position per distinct tile row, and
 * sibling subtrees divide the enclosing fine range. On the vendored isometric
 * dungeon the band is ~0.000149 while a fixed `Z_INDEX_STEP / 1024` step
 * reaches 0.00039 by the fifth atlas source — enough for a door tile to jump in
 * front of the wall row that should hide it.
 *
 * Expressing the nudge as a FRACTION of the band makes that unrepresentable:
 * every source lands in `[0, band)`, in index order, however narrow the band
 * gets.
 *
 * The FIRST source lands on 0, not above it. The band a layer is given is
 * usually shared with its siblings rather than private to it, so lifting source
 * 0 off zero would push the whole layer in front of a sibling drawing at the
 * same `z_index` — which Godot resolves by tree order, and which three resolves
 * the same way when the z values tie. Only the second and later sources need
 * separating, and only from each other.
 *
 * `sourceIndex` must be the position among the sources ACTUALLY DRAWN, not the
 * index into the tileset's full source list. Pairing a tileset-wide index with
 * a drawn-only count is what lets the result exceed the band.
 */
export function tileSourceZ(sourceIndex: number, sourceCount: number, band: number): number {
  if (sourceCount <= 0) return 0;
  return (sourceIndex / sourceCount) * band;
}

/** One atlas source's batch: its cells and its place among the drawn sources. */
export interface DrawnSource {
  sourceId: number;
  source: AtlasSourceModel;
  /** The given cells that draw from this source, in their original order. */
  cells: readonly PlacedCell[];
  /** Position among the DRAWN sources — dense, tileset order preserved. */
  sourceIndex: number;
  /** How many sources are drawn — the `sourceIndex` above is one of these. */
  sourceCount: number;
}

/**
 * Partition `cells` into one batch per atlas source, in the tileset's source
 * order, dropping the sources this set of cells does not draw from.
 *
 * `sourceIndex` and `sourceCount` ride the SAME object because `tileSourceZ`
 * takes both as plain numbers and cannot tell a tileset-wide index paired with
 * a drawn-only count — the pairing that lets the nudge run past the band — from
 * a valid one. Every call site destructures them together, so the mismatch has
 * nowhere to enter.
 *
 * One bucketing pass rather than a filter per source: the y-sort pass mounts one
 * batch set per tile ROW, so a filter chain costs sources × cells per row and
 * the row count grows with the map.
 */
export function drawnSources(
  model: Pick<TileSetModel, 'sources' | 'sourceOrder'>,
  cells: readonly PlacedCell[]
): readonly DrawnSource[] {
  const bySource = new Map<number, PlacedCell[]>();
  for (const cell of cells) {
    const bucket = bySource.get(cell.sourceId);
    if (bucket) bucket.push(cell);
    else bySource.set(cell.sourceId, [cell]);
  }
  // Walking `sourceOrder` rather than the buckets keeps the tileset's order and
  // drops cells that name a source the tileset does not define — those have no
  // atlas to draw from.
  const drawn = model.sourceOrder.filter((id) => bySource.get(id)?.length);
  return drawn.map((sourceId, sourceIndex) => ({
    sourceId,
    source: model.sources.get(sourceId)!,
    cells: bySource.get(sourceId)!,
    sourceIndex,
    sourceCount: drawn.length,
  }));
}
