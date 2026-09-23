/**
 * Partitions a tile layer's cells into one batch mesh per atlas source. Godot interleaves sources
 * in scan order, so the batches take `sourceIndex` as their `renderOrder`, within the layer's one
 * place in the canvas that its group carries (`canvasPaintOrder.ts`).
 */
import type { PlacedCell } from '../nodes/2d/tiles/shared/tileData';
import type { AtlasSourceModel, TileSetModel } from '../resources/tileset/types';

/** One atlas source's batch: its cells and its place among the drawn sources. */
export interface DrawnSource {
  sourceId: number;
  source: AtlasSourceModel;
  /** The given cells that draw from this source, in their original order. */
  cells: readonly PlacedCell[];
  /** Position among the drawn sources: dense, in tileset order. */
  sourceIndex: number;
  /** How many sources are drawn, which bounds `sourceIndex`. */
  sourceCount: number;
}

/**
 * Partitions `cells` into one batch per atlas source in tileset order, dropping sources no cell draws
 * from. One bucketing pass, not a filter per source: the y-sort pass mounts a batch set per tile
 * row, so a filter chain costs sources × cells per row.
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
  // Walking `sourceOrder`, not the buckets, keeps the tileset's order and drops cells naming a
  // source the tileset does not define, which have no atlas.
  const drawn = model.sourceOrder.filter((id) => bySource.get(id)?.length);
  return drawn.map((sourceId, sourceIndex) => ({
    sourceId,
    source: model.sources.get(sourceId)!,
    cells: bySource.get(sourceId)!,
    sourceIndex,
    sourceCount: drawn.length,
  }));
}
