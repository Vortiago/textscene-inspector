/**
 * Where a global-coords emitter spawns from, read off its own group. With
 * `local_coords = false`, the default, Godot draws the canvas item with an
 * identity transform (`cpu_particles_2d.cpp:120`), so a pose drawn inside the
 * emitter's group maps back through that group's inverse.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import { TRANSFORM2D_IDENTITY, type Transform2DColumns } from '../../../godot/transform2d.js';

/**
 * The Godot 2D global transform behind a three world matrix.
 *
 * The 2D subtree is rendered conjugated by `F = diag(1, -1, 1)`
 * (`node2dTransform`), so the world matrix is `F·G·F` and `G = F·W·F`: the
 * off-diagonal terms of the 2×2 flip sign and the Y translation negates.
 */
export function godotTransform2DFromWorldMatrix(matrix: THREE.Matrix4): Transform2DColumns {
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

/** Do two transforms place the emitter identically? */
export function sameTransform2D(p: Transform2DColumns, q: Transform2DColumns): boolean {
  return p.a === q.a && p.b === q.b && p.c === q.c && p.d === q.d && p.tx === q.tx && p.ty === q.ty;
}

/**
 * The emitter's world transform in Godot pixel space. The identity while
 * `container` is not in the tree, and always for a `local_coords` emitter. Three
 * assembles the world transform, so it is sampled once: the pose is frozen.
 */
export function useEmissionTransform(
  container: THREE.Object3D | null,
  localCoords: boolean
): Transform2DColumns {
  const [transform, setTransform] = useState<Transform2DColumns>(TRANSFORM2D_IDENTITY);
  const published = useRef(transform);

  useLayoutEffect(() => {
    let next = TRANSFORM2D_IDENTITY;
    if (container && !localCoords) {
      // A layout pass runs before the renderer's own `updateMatrixWorld`, so
      // the ancestors' matrices are refreshed rather than trusted.
      container.updateWorldMatrix(true, false);
      next = godotTransform2DFromWorldMatrix(container.matrixWorld);
    }
    if (sameTransform2D(published.current, next)) return;
    published.current = next;
    setTransform(next);
  }, [container, localCoords]);

  return transform;
}
