/**
 * HeightMapShape3D decode: property bag in, sample grid out.
 *
 * Godot loads the properties in file order, and each setter reads the grid the earlier ones left
 * (`height_map_shape_3d.cpp:155-229`), so the decode replays them in that order.
 */

import { intOr } from '../../../parser/valueParsers';
import { warn } from '../../../logger';
import { parsePackedFloat32Array } from '../packedArray';
import type { HeightMapShape3DProperties } from './types';

/** `height_map_shape_3d.h:41-42`: the grid the constructor builds. */
const DEFAULT_SIZE = 2;

/** A grid in the middle of the replay; `heights` always holds `width * depth` samples. */
type Grid = HeightMapShape3DProperties;

/** Resizes to the new sample count, keeping the heights in place and zero-filling the rest (`:155-201`). */
function resized(grid: Grid, width: number, depth: number): Grid {
  const heights = new Float32Array(width * depth);
  heights.set(grid.heights.subarray(0, Math.min(grid.heights.length, heights.length)));
  return { width, depth, heights };
}

/** `set_map_width` / `set_map_depth` return without a change for a value below one (`:156`, `:180`). */
function withSize(grid: Grid, axis: 'width' | 'depth', text: string): Grid {
  const size = intOr(text, grid[axis], `HeightMapShape3D map_${axis}`);
  if (size < 1) return grid;
  return axis === 'width' ? resized(grid, size, grid.depth) : resized(grid, grid.width, size);
}

/** `set_map_data` copies only an array of exactly `width * depth` samples (`:203-206`). */
function withHeights(grid: Grid, text: string): Grid {
  try {
    const heights = parsePackedFloat32Array(text);
    if (heights.length !== grid.heights.length) return grid;
    return { ...grid, heights: Float32Array.from(heights) };
  } catch (error) {
    warn(`HeightMapShape3D map_data: ${error instanceof Error ? error.message : String(error)}`);
    return grid;
  }
}

export function decodeHeightMapShape3D(properties: Record<string, string>): HeightMapShape3DProperties {
  let grid: Grid = {
    width: DEFAULT_SIZE,
    depth: DEFAULT_SIZE,
    heights: new Float32Array(DEFAULT_SIZE * DEFAULT_SIZE),
  };
  for (const [name, text] of Object.entries(properties)) {
    if (name === 'map_width') grid = withSize(grid, 'width', text);
    else if (name === 'map_depth') grid = withSize(grid, 'depth', text);
    else if (name === 'map_data') grid = withHeights(grid, text);
  }
  return grid;
}
