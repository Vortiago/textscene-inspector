/**
 * Godot's rendering quadrants for a TileMapLayer that is not y-sorted (`tile_map_layer.cpp:542-566`):
 * each `rendering_quadrant_size` square of cells is a canvas item of its own, so it takes its own
 * light list. The quadrants draw in the order `_rendering_update` gives them (`:412-434`).
 */

import type { PlacedCell } from '../../nodes/2d/tiles/shared/tileData';
import { mapToLocalPx } from './tilePlacement';
import { groupBySortY } from './tileYSort';
import type { TileGrid, Vec2i } from './types';

interface Quadrant {
  readonly coords: Vec2i;
  readonly cells: PlacedCell[];
}

/** `RenderingQuadrant::CoordsWorldComparator` (`tile_map_layer.h:210-219`): y up, then x down. */
function compareQuadrants(grid: TileGrid, a: Quadrant, b: Quadrant): number {
  // Godot sorts by `map_to_local` of the quadrant coords, not of the quadrant's first cell.
  const localA = mapToLocalPx(grid, a.coords);
  const localB = mapToLocalPx(grid, b.coords);
  return localA.y === localB.y ? localB.x - localA.x : localA.y - localB.y;
}

/** `CellData::operator<` (`tile_map_layer.h:134-136`): `Vector2i` order, x then y. */
function compareCells(a: PlacedCell, b: PlacedCell): number {
  return a.coords.x - b.coords.x || a.coords.y - b.coords.y;
}

/** The cells of each rendering quadrant, in draw order, each sorted as Godot draws them. */
export function renderingQuadrants(
  cells: readonly PlacedCell[],
  grid: TileGrid,
  quadrantSize: number
): readonly (readonly PlacedCell[])[] {
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
    else byKey.set(key, { coords, cells: [cell] });
  }
  return [...byKey.values()]
    .sort((a, b) => compareQuadrants(grid, a, b))
    .map((quadrant) => quadrant.cells.sort(compareCells));
}

/** How a layer splits into quadrants. */
export interface QuadrantLayout {
  readonly ySortEnabled: boolean;
  /** Added to each row's sort Y while y-sorted. */
  readonly ySortOrigin: number;
  /** `rendering_quadrant_size`, used while not y-sorted. */
  readonly quadrantSize: number;
}

/**
 * A layer's rendering quadrants in draw order. A y-sorted layer makes each tile row a quadrant
 * (`tile_map_layer.cpp:546-548`), which its own y-sort draws from the top row down.
 */
export function layerQuadrants(
  cells: readonly PlacedCell[],
  grid: TileGrid,
  layout: QuadrantLayout
): readonly (readonly PlacedCell[])[] {
  if (!layout.ySortEnabled) return renderingQuadrants(cells, grid, layout.quadrantSize);
  return groupBySortY(cells, grid, layout.ySortOrigin, 0).map((row) => row.cells);
}
