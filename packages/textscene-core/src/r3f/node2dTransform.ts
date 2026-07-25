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

import * as THREE from 'three';
import type { Node2DLocalTransform } from '../nodes/base/node2d/types';
import type { Vec3Tuple } from './nodeTransform';

export interface Node2DGroupProps {
  position: Vec3Tuple;
  rotation: Vec3Tuple;
  scale: Vec3Tuple;
  /**
   * Set ONLY when a non-zero `skew` shear is present — a shear cannot be
   * expressed as Euler rotation + scale, so the whole local transform is baked
   * into a Matrix4 instead. Consumers apply it via `node2dGroupSpread`.
   */
  matrix?: THREE.Matrix4;
}

/** Draw-order spacing per z-index step (world units along +Z toward the camera). */
export const Z_INDEX_STEP = 0.1;

/**
 * Fine draw-order range WITHIN one z-index step, shared by y-sort ranks and the
 * tree-order slots that separate sibling y-sort subtrees (see YSortSlotContext).
 * Half a step so a `show_behind_parent` node (which sits at `-Z_INDEX_STEP*0.5`)
 * never collides with the fine band above the layer base.
 */
export const YSORT_FINE_RANGE = Z_INDEX_STEP * 0.5;

/**
 * Sub-z_index draw-order spacing inside a TileMap node: legacy layers stack by
 * index within one z_index step, and each layer's atlas sources get a smaller
 * deterministic nudge (Godot interleaves cells across sources in scan order —
 * unattainable under per-source batching).
 */
export const TILE_LAYER_STEP = Z_INDEX_STEP / 64;
export const TILE_SOURCE_STEP = Z_INDEX_STEP / 1024;

/**
 * The +Z draw-order offset for a CanvasItem: `z_index` scaled by the step,
 * nudged half a step BACK when `show_behind_parent` is set so the node sits
 * just behind its parent's origin (Godot draws it underneath the parent).
 */
export function canvasItemZ(props: { z_index: number; show_behind_parent?: boolean }): number {
  const base = props.z_index * Z_INDEX_STEP;
  return props.show_behind_parent ? base - Z_INDEX_STEP * 0.5 : base;
}

export function node2dGroupProps(t: Node2DLocalTransform, z = 0): Node2DGroupProps {
  // `0 - v` (not `-v`) so a zero input stays +0, never -0.
  const position: Vec3Tuple = [t.position.x, 0 - t.position.y, z];
  const rotation: Vec3Tuple = [0, 0, 0 - t.rotation];
  const scale: Vec3Tuple = [t.scale.x, t.scale.y, 1];

  const skew = t.skew ?? 0;
  if (skew === 0) return { position, rotation, scale };

  // Godot composes the 2D transform as T·R·Skew·S, where `skew` tilts the local
  // Y axis by `skew` rad relative to X. That shear is not expressible as Euler
  // rotation + scale, so bake the full transform into a Matrix4. We render the
  // 2D subtree conjugated by F = diag(1, −1, 1) (see module header), so the
  // three.js-space linear part is F·L·F:
  //   x' =  cos(rot)·sx · x + sin(rot+skew)·sy · y
  //   y' = −sin(rot)·sx · x + cos(rot+skew)·sy · y
  // and the translation is the (already Y-negated) `position`. This stays
  // composition-correct under nesting because F·M1·F · F·M2·F = F·(M1·M2)·F.
  const sx = t.scale.x;
  const sy = t.scale.y;
  const c = Math.cos(t.rotation);
  const s = Math.sin(t.rotation);
  const cS = Math.cos(t.rotation + skew);
  const sS = Math.sin(t.rotation + skew);
  const matrix = new THREE.Matrix4().set(
    c * sx, sS * sy, 0, position[0],
    -s * sx, cS * sy, 0, position[1],
    0, 0, 1, position[2],
    0, 0, 0, 1
  );
  return { position, rotation, scale, matrix };
}

/**
 * Spreadable `<group>` transform props: discrete position/rotation/scale for the
 * common (skew-free) case, or a baked `matrix` with `matrixAutoUpdate=false`
 * when a shear is present (the matrix would otherwise be overwritten from the
 * group's identity position/quaternion/scale each frame).
 */
export function node2dGroupSpread(
  g: Node2DGroupProps
):
  | { position: Vec3Tuple; rotation: Vec3Tuple; scale: Vec3Tuple }
  | { matrix: THREE.Matrix4; matrixAutoUpdate: false } {
  return g.matrix
    ? { matrix: g.matrix, matrixAutoUpdate: false }
    : { position: g.position, rotation: g.rotation, scale: g.scale };
}
