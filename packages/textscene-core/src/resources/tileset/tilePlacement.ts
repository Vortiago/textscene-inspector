/**
 * Cell-placement math — Godot's `map_to_local`: grid coordinates → the CENTER
 * of the cell in local pixels (Godot 2D space, +Y down). Pure module.
 */

import type { TileGrid, Vec2i } from './tileSetModel';

export function mapToLocalPx(grid: TileGrid, cell: Vec2i): { x: number; y: number } {
  return {
    x: (cell.x + 0.5) * grid.tileSize.x,
    y: (cell.y + 0.5) * grid.tileSize.y,
  };
}
