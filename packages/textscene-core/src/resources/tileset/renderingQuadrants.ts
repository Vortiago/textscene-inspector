/**
 * Godot's rendering quadrants for a TileMapLayer that is not y-sorted (`tile_map_layer.cpp:542-566`):
 * each `rendering_quadrant_size` square of cells is a canvas item of its own, so it takes its own
 * light list. The quadrants draw in the order `_rendering_update` gives them (`:412-434`).
 */

import type { PlacedCell } from '../../nodes/2d/tiles/shared/tileData';
import { drawableCells, type DrawableCell } from './drawableCell';
import { compareCells } from './cellOrder';
import { mapToLocalPx } from './tilePlacement';
import { ySortRows } from './tileYSort';
import type { TileGrid, TileSetModel } from './types';

/** A rendering quadrant's drawable cells, and where its canvas items sit in the layer. */
export interface RenderingQuadrant {
  /** `RenderingQuadrant::canvas_items_position`, the origin of its canvas items (`:544-555`). */
  readonly canvasItemsPosition: { x: number; y: number };
  readonly cells: readonly DrawableCell[];
}

interface Quadrant extends RenderingQuadrant {
  /** `map_to_local` of the quadrant coords, not of its first cell, which Godot sorts by (`:418`). */
  readonly local: { x: number; y: number };
  readonly cells: DrawableCell[];
}

/** `RenderingQuadrant::CoordsWorldComparator` (`tile_map_layer.h:210-219`): y up, then x down. */
function compareQuadrants(a: Quadrant, b: Quadrant): number {
  return a.local.y === b.local.y ? b.local.x - a.local.x : a.local.y - b.local.y;
}

/** The cells of each rendering quadrant, in draw order, each sorted as Godot draws them. */
function renderingQuadrants(
  cells: readonly DrawableCell[],
  grid: TileGrid,
  quadrantSize: number
): readonly RenderingQuadrant[] {
  const byKey = new Map<string, Quadrant>();
  for (const cell of cells) {
    // `_coords_to_quadrant_coords` (`:53-57`) rounds down, not towards zero.
    const coords = {
      x: Math.floor(cell.coords.x / quadrantSize),
      y: Math.floor(cell.coords.y / quadrantSize),
    };
    const key = `${coords.x},${coords.y}`;
    const quadrant = byKey.get(key);
    if (quadrant) quadrant.cells.push(cell);
    else byKey.set(key, quadrantAt(grid, coords, quadrantSize, cell));
  }
  return [...byKey.values()]
    .sort(compareQuadrants)
    .map(({ canvasItemsPosition, cells }) => ({ canvasItemsPosition, cells: cells.sort(compareCells) }));
}

function quadrantAt(
  grid: TileGrid,
  coords: { x: number; y: number },
  quadrantSize: number,
  cell: DrawableCell
): Quadrant {
  const first = { x: coords.x * quadrantSize, y: coords.y * quadrantSize };
  return { local: mapToLocalPx(grid, coords), canvasItemsPosition: mapToLocalPx(grid, first), cells: [cell] };
}

/** How a layer splits into quadrants. */
interface QuadrantLayout {
  readonly ySortEnabled: boolean;
  /** Added to each row's sort Y while y-sorted. */
  readonly ySortOrigin: number;
  /** `rendering_quadrant_size`, used while not y-sorted. */
  readonly quadrantSize: number;
}

/**
 * A layer's rendering quadrants of drawable cells, in draw order. A y-sorted layer makes each tile
 * row a quadrant (`tile_map_layer.cpp:546-548`), which its own y-sort draws from the top row down.
 */
export function layerQuadrants(
  cells: readonly PlacedCell[],
  model: TileSetModel,
  layout: QuadrantLayout
): readonly RenderingQuadrant[] {
  const drawable = drawableCells(model, cells);
  if (!layout.ySortEnabled) return renderingQuadrants(drawable, model, layout.quadrantSize);
  return ySortRows(drawable, model, layout.ySortOrigin).map(({ y, cells }) => ({
    canvasItemsPosition: { x: 0, y },
    cells,
  }));
}
