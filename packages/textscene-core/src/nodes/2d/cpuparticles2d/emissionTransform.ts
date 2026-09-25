/**
 * Where a global-coords emitter spawns from, read off its own group. With
 * `local_coords = false`, the default, Godot draws the canvas item with an
 * identity transform (`cpu_particles_2d.cpp:120`), so a pose drawn inside the
 * emitter's group maps back through that group's inverse.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import { TRANSFORM2D_IDENTITY, type Transform2DColumns } from '../../../godot/transform2d.js';
import { transform2DFromThreeMatrix } from '../../../r3f/node2dTransform';

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
      // The 2D subtree renders conjugated, so the world matrix maps back through the flip.
      next = transform2DFromThreeMatrix(container.matrixWorld);
    }
    if (sameTransform2D(published.current, next)) return;
    published.current = next;
    setTransform(next);
  }, [container, localCoords]);

  return transform;
}
