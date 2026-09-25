/**
 * Maps a Godot `Node2D` transform into three.js: `<group>` props for a local one, and a
 * `Matrix4` both ways for any `Transform2D`. Godot 2D is `+Y` down with clockwise
 * rotation, and three.js is `+Y` up, so each transform is conjugated by
 * `F = diag(1, -1, 1)`: Y translation and rotation negate, scale stays. One pixel is
 * one world unit, in the z=0 plane.
 */

import * as THREE from 'three';
import type { Node2DLocalTransform } from '../nodes/base/node2d/types';
import type { Vec3Tuple } from './nodeTransform';
import { transform2DFromParts, type Transform2DColumns } from '../godot/transform2d.js';

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

  const matrix = threeMatrixFromTransform2D(
    transform2DFromParts(t.rotation, t.scale, skew, t.position),
    z
  );
  return { position, rotation, scale, matrix };
}

/**
 * A Node2D's local `Transform2D`, each absent part at its `node_2d.h:39-42` default: position
 * `(0, 0)`, rotation 0, scale `(1, 1)` and skew 0. A hand-built bag may skip the parser that
 * fills them.
 */
export function node2DLocalTransform(parts: Partial<Node2DLocalTransform>): Transform2DColumns {
  return transform2DFromParts(
    parts.rotation ?? 0,
    parts.scale ?? { x: 1, y: 1 },
    parts.skew ?? 0,
    parts.position ?? { x: 0, y: 0 }
  );
}

/**
 * `t` conjugated by F at depth `z`: Godot's `columns[0] = (a, b)`, `columns[1] = (c, d)` and
 * `columns[2] = (tx, ty)` become `[a, -c, tx; -b, d, -ty]`. Baked whole, so a shear survives.
 */
export function threeMatrixFromTransform2D(t: Transform2DColumns, z = 0): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    t.a, -t.c, 0, t.tx,
    // `0 - ty` (not `-ty`) so a zero origin stays +0, as in `node2dGroupProps`.
    -t.b, t.d, 0, 0 - t.ty,
    0, 0, 1, z,
    0, 0, 0, 1
  );
}

/**
 * The Godot `Transform2D` behind a matrix in the conjugated space, the inverse of
 * {@link threeMatrixFromTransform2D}: F is its own inverse, so the 2x2's off-diagonal terms flip
 * sign and the Y translation negates.
 */
export function transform2DFromThreeMatrix(matrix: THREE.Matrix4): Transform2DColumns {
  const e = matrix.elements;
  return {
    a: e[0]!,
    b: 0 - e[1]!,
    c: 0 - e[4]!,
    d: e[5]!,
    tx: e[12]!,
    ty: 0 - e[13]!,
  };
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
