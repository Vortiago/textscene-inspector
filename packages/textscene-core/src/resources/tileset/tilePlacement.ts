/**
 * Cell-placement math — Godot's `map_to_local`: grid coordinates → the CENTER
 * of the cell in local pixels (Godot 2D space, +Y down). Pure module.
 *
 * The isometric arms are transcribed verbatim from Godot's
 * TileSet::map_to_local (scene/resources/2d/tile_set.cpp): a layout-dependent
 * remap of the grid coordinates, the overlap ratio (0.5 for isometric) applied
 * to the offset axis, then `(ret + 0.5) * tile_size`. Half-offset-square and
 * hexagon shapes are out of scope (ADR-0008): they fall back to square
 * placement silently here — the resolver warns once per TileSet (this runs
 * once per cell).
 */

import { TILE_SHAPE_ISOMETRIC, type TileGrid, type Vec2i } from './tileSetModel';

/** Positive modulo (Godot's Math::posmod) — posmod(-1, 2) === 1. */
function posmod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

export function mapToLocalPx(grid: TileGrid, cell: Vec2i): { x: number; y: number } {
  let x = cell.x;
  let y = cell.y;

  if (grid.shape === TILE_SHAPE_ISOMETRIC) {
    if (grid.offsetAxis === 0) {
      switch (grid.layout) {
        case 0: // STACKED
          x += posmod(y, 2) === 0 ? 0 : 0.5;
          break;
        case 1: // STACKED_OFFSET
          x += posmod(y, 2) === 1 ? 0 : 0.5;
          break;
        case 2: // STAIRS_RIGHT
          x += y / 2;
          break;
        case 3: { // STAIRS_DOWN
          const rawX = x;
          x = rawX / 2;
          y = y * 2 + rawX;
          break;
        }
        case 4: { // DIAMOND_RIGHT
          const rawX = x;
          x = (rawX + y) / 2;
          y = y - rawX;
          break;
        }
        case 5: { // DIAMOND_DOWN
          const rawX = x;
          x = (rawX - y) / 2;
          y = y + rawX;
          break;
        }
      }
      y *= 0.5; // isometric overlap ratio
    } else {
      switch (grid.layout) {
        case 0: // STACKED
          y += posmod(x, 2) === 0 ? 0 : 0.5;
          break;
        case 1: // STACKED_OFFSET
          y += posmod(x, 2) === 1 ? 0 : 0.5;
          break;
        case 2: { // STAIRS_RIGHT
          const rawY = y;
          y = rawY / 2;
          x = x * 2 + rawY;
          break;
        }
        case 3: // STAIRS_DOWN
          y += x / 2;
          break;
        case 4: { // DIAMOND_RIGHT
          const rawY = y;
          y = (rawY - x) / 2;
          x = x + rawY;
          break;
        }
        case 5: { // DIAMOND_DOWN
          const rawY = y;
          y = (rawY + x) / 2;
          x = x - rawY;
          break;
        }
      }
      x *= 0.5;
    }
  }

  return { x: (x + 0.5) * grid.tileSize.x, y: (y + 0.5) * grid.tileSize.y };
}
