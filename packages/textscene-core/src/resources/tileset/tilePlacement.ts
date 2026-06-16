/**
 * Cell-placement math — Godot's `map_to_local`: grid coordinates → the CENTER
 * of the cell in local pixels (Godot 2D space, +Y down). Pure module.
 *
 * The arms are transcribed verbatim from Godot's TileSet::map_to_local
 * (scene/resources/2d/tile_set.cpp): every non-square shape shares one
 * layout-dependent remap of the grid coordinates, then an overlap ratio applied
 * to the offset axis (0.5 isometric, 0.75 hexagon, 1.0 half-offset square), then
 * `(ret + 0.5) * tile_size`. Square placement is the untouched default.
 */

import {
  TILE_SHAPE_HALF_OFFSET_SQUARE,
  TILE_SHAPE_HEXAGON,
  TILE_SHAPE_ISOMETRIC,
  type TileGrid,
  type Vec2i,
} from './tileSetModel';

/** Positive modulo (Godot's Math::posmod) — posmod(-1, 2) === 1. */
function posmod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

/** Shapes whose cells stagger along an offset axis; everything else is plain square. */
function isStaggered(shape: number): boolean {
  return (
    shape === TILE_SHAPE_ISOMETRIC ||
    shape === TILE_SHAPE_HALF_OFFSET_SQUARE ||
    shape === TILE_SHAPE_HEXAGON
  );
}

/** Godot's offset-axis overlap ratio: hexagons overlap by ¼, isometric by ½. */
function overlapRatio(shape: number): number {
  if (shape === TILE_SHAPE_ISOMETRIC) return 0.5;
  if (shape === TILE_SHAPE_HEXAGON) return 0.75;
  return 1; // half-offset square — staggered but no overlap
}

export function mapToLocalPx(grid: TileGrid, cell: Vec2i): { x: number; y: number } {
  let x = cell.x;
  let y = cell.y;

  if (isStaggered(grid.shape)) {
    const ratio = overlapRatio(grid.shape);
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
      y *= ratio; // overlap on the offset axis (horizontal axis ⇒ y)
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
      x *= ratio; // overlap on the offset axis (vertical axis ⇒ x)
    }
  }

  return { x: (x + 0.5) * grid.tileSize.x, y: (y + 0.5) * grid.tileSize.y };
}
