/**
 * Where a scene tile's instance sits: the transform the layer puts on the instance, before the
 * root's own transform. Pure math on the grid, no React.
 */

import type { Transform2DColumns } from '../../godot/math/transform2d.js';
import type { Vector2 } from '../../godot/math/vector.js';
import {
  TILE_TRANSFORM_FLIP_H,
  TILE_TRANSFORM_FLIP_V,
  TILE_TRANSFORM_TRANSPOSE,
} from '../../godot/scene/tileSet.js';
import { mapToLocalPx } from './tilePlacement';
import type { TileGrid } from './types';

/** Where a layer puts the root of a scene tile's instance: the cell, by the grid of its TileSet. */
export interface SceneTilePlacement {
  readonly grid: TileGrid;
  readonly coords: Vector2;
  readonly alternativeId: number;
}

/** The two roots Godot places: a Control and a Node2D (`tile_map_layer.cpp:1630-1636`). */
export type SceneRootKind = 'node2d' | 'control';

/**
 * A Node2D root takes `xform * own transform`, where `xform` flips and transposes the axes and
 * moves to the cell (`tile_map_layer.cpp:1706-1723`). A Control root only moves to the cell:
 * `position = map_to_local(coords) + own position` (`:1636`).
 */
export function sceneTilePlacement(
  grid: TileGrid,
  coords: Vector2,
  alternativeId: number,
  root: SceneRootKind
): Transform2DColumns {
  const origin = mapToLocalPx(grid, coords);
  const placed = { a: 1, b: 0, c: 0, d: 1, tx: origin.x, ty: origin.y };
  if (root === 'control') return placed;

  const flipX = alternativeId & TILE_TRANSFORM_FLIP_H ? -1 : 1;
  const flipY = alternativeId & TILE_TRANSFORM_FLIP_V ? -1 : 1;
  // A transpose swaps the columns the two flips land in: the horizontal axis becomes the second.
  return alternativeId & TILE_TRANSFORM_TRANSPOSE
    ? { ...placed, a: 0, b: flipY, c: flipX, d: 0 }
    : { ...placed, a: flipX, d: flipY };
}
