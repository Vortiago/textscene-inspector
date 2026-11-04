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

/** Resizes to the new sample count, keeping the heights in place and zero-filling the rest (`:155-201`). */
function resized(grid: HeightMapShape3DProperties, width: number, depth: number): HeightMapShape3DProperties {
  const heights = new Float32Array(width * depth);
  heights.set(grid.heights.subarray(0, Math.min(grid.heights.length, heights.length)));
  return { width, depth, heights };
}

/** `set_map_width` returns without a change for a value below one (`:156`). */
function withWidth(grid: HeightMapShape3DProperties, text: string): HeightMapShape3DProperties {
  const width = intOr(text, grid.width, 'HeightMapShape3D map_width');
  return width < 1 ? grid : resized(grid, width, grid.depth);
}

/** `set_map_depth` returns without a change for a value below one (`:180`). */
function withDepth(grid: HeightMapShape3DProperties, text: string): HeightMapShape3DProperties {
  const depth = intOr(text, grid.depth, 'HeightMapShape3D map_depth');
  return depth < 1 ? grid : resized(grid, grid.width, depth);
}

/** `set_map_data` copies only an array of exactly `width * depth` samples (`:203-206`). */
function withHeights(grid: HeightMapShape3DProperties, text: string): HeightMapShape3DProperties {
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
  let grid: HeightMapShape3DProperties = {
    width: DEFAULT_SIZE,
    depth: DEFAULT_SIZE,
    heights: new Float32Array(DEFAULT_SIZE * DEFAULT_SIZE),
  };
  for (const [name, text] of Object.entries(properties)) {
    if (name === 'map_width') grid = withWidth(grid, text);
    else if (name === 'map_depth') grid = withDepth(grid, text);
    else if (name === 'map_data') grid = withHeights(grid, text);
  }
  return grid;
}
