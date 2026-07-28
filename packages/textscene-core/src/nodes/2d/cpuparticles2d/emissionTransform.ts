/**
 * Where a global-coords emitter spawns from, read off its own group.
 *
 * With `local_coords = false` — Godot's DEFAULT — particles live in canvas
 * space: Godot spawns them through the emitter's global transform and then
 * draws the canvas item with an IDENTITY transform
 * (`set_canvas_item_use_identity_transform(!local_coords)`,
 * `cpu_particles_2d.cpp:120`). We render inside the emitter's own group, which
 * carries that transform, so the pose has to be mapped back through its
 * inverse. The visible consequence is not subtle: a node scaled to 0.6 does NOT
 * shrink its particles, because the two scalings cancel.
 *
 * A node's world transform is not a React value — it is the product of every
 * ancestor Node2D transform, assembled by three — so it is SAMPLED from the
 * object, the same way `shadowLightPose` samples a light's. Unlike a light this
 * needs no per-frame refresh: the pose is frozen by construction (see
 * simulate.ts), so a layout-pass read is the whole story.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import { IDENTITY_AFFINE, type Affine2D } from './simulate';

/**
 * The Godot 2D global transform behind a three world matrix.
 *
 * The 2D subtree is rendered conjugated by `F = diag(1, -1, 1)`
 * (`node2dTransform`), so the world matrix is `F·G·F` and `G = F·W·F`: the
 * off-diagonal terms of the 2×2 flip sign and the Y translation negates.
 */
export function godotAffineFromWorldMatrix(matrix: THREE.Matrix4): Affine2D {
  const e = matrix.elements;
  return {
    ax: e[0]!,
    ay: 0 - e[1]!,
    bx: 0 - e[4]!,
    by: e[5]!,
    ox: e[12]!,
    oy: 0 - e[13]!,
  };
}

/** Do two transforms place the emitter identically? */
export function sameAffine(a: Affine2D, b: Affine2D): boolean {
  return (
    a.ax === b.ax && a.ay === b.ay && a.bx === b.bx && a.by === b.by && a.ox === b.ox && a.oy === b.oy
  );
}

/**
 * The emitter's world transform in Godot pixel space, or the identity while
 * `container` is not yet in the tree — and always the identity for a
 * `local_coords` emitter, which needs no mapping at all.
 */
export function useEmissionTransform(
  container: THREE.Object3D | null,
  localCoords: boolean
): Affine2D {
  const [transform, setTransform] = useState<Affine2D>(IDENTITY_AFFINE);
  const published = useRef(transform);

  useLayoutEffect(() => {
    let next = IDENTITY_AFFINE;
    if (container && !localCoords) {
      // A layout pass runs before the renderer's own `updateMatrixWorld`, so
      // the ancestors' matrices are refreshed rather than trusted.
      container.updateWorldMatrix(true, false);
      next = godotAffineFromWorldMatrix(container.matrixWorld);
    }
    if (sameAffine(published.current, next)) return;
    published.current = next;
    setTransform(next);
  }, [container, localCoords]);

  return transform;
}
