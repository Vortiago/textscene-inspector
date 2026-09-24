/**
 * Maps a Godot `Node2D` local transform onto R3F `<group>` props. Godot 2D is
 * `+Y` down with clockwise rotation, and three.js is `+Y` up, so each local
 * transform is conjugated by `F = diag(1, -1, 1)`: Y translation and rotation
 * negate, scale stays. One pixel is one world unit, in the z=0 plane.
 */

import * as THREE from 'three';
import type { Node2DLocalTransform } from '../nodes/base/node2d/types';
import type { Vec3Tuple } from './nodeTransform';
import { transform2DFromParts } from '../godot/transform2d.js';

// F is its own inverse, so `F·M1·F · F·M2·F = F·(M1·M2)·F` composes through any
// nesting with no global flip group: Godot `(100, 50)` sits at three.js `(100, -50)`.
// Draw order is `renderOrder`, not depth (`canvasPaintOrder.ts`).
export interface Node2DGroupProps {
  position: Vec3Tuple;
  rotation: Vec3Tuple;
  scale: Vec3Tuple;
  /**
   * Set only for a non-zero `skew`, which Euler rotation and scale cannot express,
   * so the whole local transform is baked into a Matrix4. Consumers apply it
   * through `node2dGroupSpread`.
   */
  matrix?: THREE.Matrix4;
}

export function node2dGroupProps(t: Node2DLocalTransform, z = 0): Node2DGroupProps {
  // `0 - v` (not `-v`) so a zero input stays +0, never -0.
  const position: Vec3Tuple = [t.position.x, 0 - t.position.y, z];
  const rotation: Vec3Tuple = [0, 0, 0 - t.rotation];
  const scale: Vec3Tuple = [t.scale.x, t.scale.y, 1];

  const skew = t.skew ?? 0;
  if (skew === 0) return { position, rotation, scale };

  // Conjugated by F, Godot's linear part `[a c; b d]` is `[a -c; -b d]`, placed at the
  // Y-negated `position`.
  const { a, b, c, d } = transform2DFromParts(t.rotation, t.scale, skew, t.position);
  const matrix = new THREE.Matrix4().set(
    a, -c, 0, position[0],
    -b, d, 0, position[1],
    0, 0, 1, position[2],
    0, 0, 0, 1
  );
  return { position, rotation, scale, matrix };
}

/**
 * The same local transform as a `Matrix4`, for a consumer composing this item's
 * space with another. Re-deriving it from the discrete props gives a different
 * answer for a sheared item.
 */
export function node2dGroupMatrix(g: Node2DGroupProps): THREE.Matrix4 {
  if (g.matrix) return g.matrix.clone();
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...g.position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...g.rotation)),
    new THREE.Vector3(...g.scale)
  );
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
