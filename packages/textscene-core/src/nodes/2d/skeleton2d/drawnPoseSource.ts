/** Where the drawn nodes of a render stand: the {@link PoseSource} of the pose a Skeleton2D draws. */

import type * as THREE from 'three';
import {
  affineInverseTransform2D,
  multiplyTransform2D,
  mutableTransform2D,
  type Transform2DColumns,
} from '../../../godot/math/transform2d.js';
import { storedTransform2D } from '../../../godot/math/real.js';
import { canvasTransformInto, transform2DWithin } from '../../../r3f/node2dTransform.js';
import type { PoseSource } from './buildStackScene.js';

/** The global transform of a drawn node as a `real_t` Transform2D holds it. */
function canvasTransformOf(object: THREE.Object3D): Transform2DColumns {
  return storedTransform2D(canvasTransformInto(mutableTransform2D(), object));
}

/**
 * The transform of a drawn node within a drawn node above it, as a `real_t` Transform2D holds it.
 * A chain that folds onto one line bends to the side the last bit of an input picks, so the
 * transform comes from the local matrices, and through the world matrices only as a last resort.
 */
function transformWithin(object: THREE.Object3D, ancestor: THREE.Object3D): Transform2DColumns {
  return storedTransform2D(
    transform2DWithin(object, ancestor) ??
      multiplyTransform2D(affineInverseTransform2D(canvasTransformOf(ancestor)), canvasTransformOf(object))
  );
}

export const DRAWN_POSE_SOURCE: PoseSource<THREE.Object3D> = {
  canvas: canvasTransformOf,
  within: transformWithin,
  parent: (object) => object.parent,
};
