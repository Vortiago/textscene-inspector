/**
 * Splits a rendering quadrant into the canvas items Godot draws it with (`tile_map_layer.cpp:313-376`):
 * a new item at each change of tile material or `z_index` in the quadrant's cell order, each batched
 * into runs of consecutive cells that share an atlas source.
 */

import type { PlacedCell } from '../../nodes/2d/tiles/shared/tileData';
import { CANVAS_ITEM_Z_MAX, CANVAS_ITEM_Z_MIN } from '../../godot/rendering';
import { drawableCell, type DrawableCell } from './drawableCell';
import type { AtlasSourceModel, TileMaterial, TileSetModel } from './types';

/** One batch: consecutive cells of a canvas item that draw from one atlas source. */
export interface TileSourceRun {
  sourceId: number;
  source: AtlasSourceModel;
  cells: readonly DrawableCell[];
}

/** One canvas item of a quadrant, in draw order. */
export interface TileCanvasItem {
  /** The tiles' own material, or null for the layer's (`tile_map_layer.cpp:350`). */
  material: TileMaterial | null;
  /** The `z_index` the item holds, relative to the layer's `z_final`. */
  zIndex: number;
  runs: readonly TileSourceRun[];
}

/** The canvas items of one quadrant's cells, given in the order Godot draws them. */
export function quadrantCanvasItems(model: TileSetModel, cells: readonly PlacedCell[]): TileCanvasItem[] {
  const items: { material: TileMaterial | null; tileZIndex: number; runs: OpenRun[] }[] = [];
  for (const placed of cells) {
    const cell = drawableCell(model, placed);
    if (!cell) continue;
    const { material, zIndex: tileZIndex } = cell.tileData;
    let item = items.at(-1);
    // The material compares by identity, as Godot's `Ref` does (`:340`).
    if (item?.material !== material || item.tileZIndex !== tileZIndex) {
      item = { material, tileZIndex, runs: [] };
      items.push(item);
    }
    appendToRun(item.runs, cell, model.sources.get(cell.sourceId)!);
  }
  return items.map(({ material, tileZIndex, runs }) => ({ material, zIndex: heldZIndex(tileZIndex), runs }));
}

/** A run still taking cells. */
type OpenRun = TileSourceRun & { cells: DrawableCell[] };

function appendToRun(runs: OpenRun[], cell: DrawableCell, source: AtlasSourceModel): void {
  const last = runs.at(-1);
  if (last?.sourceId === cell.sourceId) last.cells.push(cell);
  else runs.push({ sourceId: cell.sourceId, source, cells: [cell] });
}

/**
 * `canvas_item_set_z_index` refuses a value outside the canvas z window and leaves the new item at 0
 * (`renderer_canvas_cull.cpp:1841`), though the split above compares the tile's own value.
 */
function heldZIndex(tileZIndex: number): number {
  return tileZIndex < CANVAS_ITEM_Z_MIN || tileZIndex > CANVAS_ITEM_Z_MAX ? 0 : tileZIndex;
}
