/**
 * Godot's `map_to_local` (scene/resources/2d/tile_set.cpp): grid coordinates to the centre of the
 * cell in local pixels, +Y down. Every non-square shape shares one layout remap, then an overlap
 * ratio on the offset axis, then `(ret + 0.5) * tile_size`. Square placement is the default.
 */

import type { TileGrid } from './types';
import { posmod } from '../../godot/math/math';
import type { Vector2 } from '../../godot/math/vector';
import { TileLayout, TileOffsetAxis, TileShape } from '../../godot/scene/tileSet';

/** Shapes whose cells stagger along an offset axis; everything else is plain square. */
function isStaggered(shape: number): boolean {
  return (
    shape === TileShape.TILE_SHAPE_ISOMETRIC ||
    shape === TileShape.TILE_SHAPE_HALF_OFFSET_SQUARE ||
    shape === TileShape.TILE_SHAPE_HEXAGON
  );
}

/** Godot's offset-axis overlap ratio: hexagons overlap by ¼, isometric by ½. */
function overlapRatio(shape: number): number {
  if (shape === TileShape.TILE_SHAPE_ISOMETRIC) return 0.5;
  if (shape === TileShape.TILE_SHAPE_HEXAGON) return 0.75;
  return 1; // half-offset square: staggered, no overlap
}

export function mapToLocalPx(grid: TileGrid, cell: Vector2): Vector2 {
  let x = cell.x;
  let y = cell.y;

  if (isStaggered(grid.shape)) {
    const ratio = overlapRatio(grid.shape);
    if (grid.offsetAxis === TileOffsetAxis.TILE_OFFSET_AXIS_HORIZONTAL) {
      switch (grid.layout) {
        case TileLayout.TILE_LAYOUT_STACKED:
          x += posmod(y, 2) === 0 ? 0 : 0.5;
          break;
        case TileLayout.TILE_LAYOUT_STACKED_OFFSET:
          x += posmod(y, 2) === 1 ? 0 : 0.5;
          break;
        case TileLayout.TILE_LAYOUT_STAIRS_RIGHT:
          x += y / 2;
          break;
        case TileLayout.TILE_LAYOUT_STAIRS_DOWN: {
          const rawX = x;
          x = rawX / 2;
          y = y * 2 + rawX;
          break;
        }
        case TileLayout.TILE_LAYOUT_DIAMOND_RIGHT: {
          const rawX = x;
          x = (rawX + y) / 2;
          y = y - rawX;
          break;
        }
        case TileLayout.TILE_LAYOUT_DIAMOND_DOWN: {
          const rawX = x;
          x = (rawX - y) / 2;
          y = y + rawX;
          break;
        }
      }
      y *= ratio; // overlap on the offset axis (horizontal axis ⇒ y)
    } else {
      switch (grid.layout) {
        case TileLayout.TILE_LAYOUT_STACKED:
          y += posmod(x, 2) === 0 ? 0 : 0.5;
          break;
        case TileLayout.TILE_LAYOUT_STACKED_OFFSET:
          y += posmod(x, 2) === 1 ? 0 : 0.5;
          break;
        case TileLayout.TILE_LAYOUT_STAIRS_RIGHT: {
          const rawY = y;
          y = rawY / 2;
          x = x * 2 + rawY;
          break;
        }
        case TileLayout.TILE_LAYOUT_STAIRS_DOWN:
          y += x / 2;
          break;
        case TileLayout.TILE_LAYOUT_DIAMOND_RIGHT: {
          const rawY = y;
          y = (rawY - x) / 2;
          x = x + rawY;
          break;
        }
        case TileLayout.TILE_LAYOUT_DIAMOND_DOWN: {
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
