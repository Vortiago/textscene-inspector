import type { PlacedCell } from '../nodes/2d/tiles/shared/tileData';
import type { AtlasSourceModel, TileSetModel } from '../resources/tileset/types';

/**
 * Partitioning a tile layer's cells into one batch per atlas source.
 *
 * Godot interleaves a layer's cells across atlas sources in scan order; we
 * batch one mesh per source, so the sources need a deterministic order among
 * themselves. That order is `sourceIndex`, applied as the batch mesh's own
 * `renderOrder` — draw order WITHIN the layer's one place in the canvas, which
 * its group carries (`canvasPaintOrder.ts`).
 */

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
