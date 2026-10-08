/**
 * Splits a rendering quadrant's cells into batch meshes. Godot draws a quadrant's cells in one
 * sorted order whatever their atlas source (`tile_map_layer.cpp:306-311`), so each batch is a run
 * of consecutive cells that share a source, and the runs draw in order.
 */
import type { PlacedCell } from '../nodes/2d/tiles/shared/tileData';
import type { AtlasSourceModel, TileSetModel } from '../resources/tileset/types';

/** One batch: consecutive cells of a quadrant that draw from one atlas source. */
export interface SourceRun {
  sourceId: number;
  source: AtlasSourceModel;
  cells: readonly PlacedCell[];
}

/**
 * The runs of `cells`, in their order. A cell naming a source the tileset does not define has no
 * atlas, so it is dropped and the runs around it join.
 */
export function sourceRuns(model: Pick<TileSetModel, 'sources'>, cells: readonly PlacedCell[]): SourceRun[] {
  const runs: { sourceId: number; source: AtlasSourceModel; cells: PlacedCell[] }[] = [];
  for (const cell of cells) {
    const source = model.sources.get(cell.sourceId);
    if (!source) continue;
    const last = runs.at(-1);
    if (last?.sourceId === cell.sourceId) last.cells.push(cell);
    else runs.push({ sourceId: cell.sourceId, source, cells: [cell] });
  }
  return runs;
}
