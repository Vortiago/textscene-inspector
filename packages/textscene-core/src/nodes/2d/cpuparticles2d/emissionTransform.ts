/**
 * Where a global-coords emitter spawns from, read off its own group: its transform in its canvas,
 * Godot's `get_global_transform`. With `local_coords = false`, the default, Godot draws the item at
 * the canvas transform (`cpu_particles_2d.cpp:115`, `renderer_canvas_cull.cpp:267`), so the pose
 * draws inside the emitter's group through this transform's inverse.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import {
  TRANSFORM2D_IDENTITY,
  equalTransform2D,
  type Transform2DColumns,
} from '../../../godot/math/transform2d.js';
import { transform2DFromThreeMatrix } from '../../../r3f/node2dTransform';
import { useCanvasFrame } from '../../../r3f/canvasFrame';

/**
 * The emitter's canvas transform in Godot pixel space. The identity while
 * `container` is not in the tree, and always for a `local_coords` emitter. Three
 * assembles the world transform, so it is sampled once: the pose is frozen.
 */
export function useEmissionTransform(
  container: THREE.Object3D | null,
  localCoords: boolean
): Transform2DColumns {
  const frame = useCanvasFrame();
  const [transform, setTransform] = useState<Transform2DColumns>(TRANSFORM2D_IDENTITY);
  const published = useRef(transform);

  useLayoutEffect(() => {
    const next = container && !localCoords ? canvasTransform(container, frame) : TRANSFORM2D_IDENTITY;
    if (equalTransform2D(published.current, next)) return;
    published.current = next;
    setTransform(next);
  }, [container, localCoords, frame]);

  return transform;
}

/** `object`'s transform in the canvas `frame` carries into the world, or in the world for none. */
function canvasTransform(object: THREE.Object3D, frame: THREE.Object3D | null): Transform2DColumns {
  // A layout pass runs before the renderer's own `updateMatrixWorld`, so
  // the ancestors' matrices are refreshed rather than trusted.
  object.updateWorldMatrix(true, false);
  const inCanvas = frame
    ? frame.matrixWorld.clone().invert().multiply(object.matrixWorld)
    : object.matrixWorld;
  // The 2D subtree renders conjugated, so the matrix maps back through the flip.
  return transform2DFromThreeMatrix(inCanvas);
}
