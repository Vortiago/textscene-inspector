/**
 * Maps a Godot 2D (`Node2D`) local transform onto R3F `<group>` props.
 *
 * Godot 2D space is pixels, `+X` right, `+Y` **down**, rotation positive =
 * clockwise on screen. three.js is `+Y` up. We render the whole 2D subtree in
 * three.js world coordinates by **conjugating each local transform by
 * `F = diag(1, -1, 1)`** — i.e. negate the Y translation and the rotation,
 * keep the scale. Because `F·M1·F · F·M2·F = F·(M1·M2)·F` (F is its own
 * inverse), this composes correctly through arbitrary nesting and renders the
 * scene right-side-up under any camera that views the XY plane from `+Z`. No
 * global flip group is needed, and world coordinates stay readable (a node at
 * Godot `(100, 50)` sits at three.js `(100, -50)`).
 *
 * `z` carries draw order (from `z_index` / tree order) as a small `+Z` offset so
 * higher-z content sits nearer a `+Z` camera; pixels are 1 world unit.
 */

import type { Node2DLocalTransform } from '../nodes/base/node2d/types';
import type { Vec3Tuple } from './nodeTransform';

export interface Node2DGroupProps {
  position: Vec3Tuple;
  rotation: Vec3Tuple;
  scale: Vec3Tuple;
}

/** Draw-order spacing per z-index step (world units along +Z toward the camera). */
export const Z_INDEX_STEP = 0.1;

export function node2dGroupProps(t: Node2DLocalTransform, z = 0): Node2DGroupProps {
  // `0 - v` (not `-v`) so a zero input stays +0, never -0.
  return {
    position: [t.position.x, 0 - t.position.y, z],
    rotation: [0, 0, 0 - t.rotation],
    scale: [t.scale.x, t.scale.y, 1],
  };
}
