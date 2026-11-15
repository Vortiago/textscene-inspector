/** The objects three draws with a geometry and a material: a mesh, a line or points. */

import type * as THREE from 'three';

export type Drawable = THREE.Mesh | THREE.Line | THREE.Points;

/**
 * Whether `object` is a mesh, a line or points. Line segments and a line loop are lines.
 *
 * @canonical Whether an object is a mesh, a line or points
 */
export function isDrawable(object: THREE.Object3D): object is Drawable {
  const { isMesh, isLine, isPoints } = object as Partial<Record<'isMesh' | 'isLine' | 'isPoints', boolean>>;
  return isMesh === true || isLine === true || isPoints === true;
}

/**
 * The object's own box: an instanced, batched or skinned mesh keeps one over its instances or
 * pose, any other drawable its geometry's. Built on the first ask.
 *
 * @canonical The local bounding box of a drawable, its instances included
 */
export function drawableLocalBox(drawable: Drawable): THREE.Box3 {
  const boxed = drawable as Drawable & { boundingBox?: THREE.Box3 | null; computeBoundingBox?: () => void };
  if (boxed.boundingBox !== undefined) {
    if (boxed.boundingBox === null) boxed.computeBoundingBox!();
    return boxed.boundingBox!;
  }
  if (drawable.geometry.boundingBox === null) drawable.geometry.computeBoundingBox();
  return drawable.geometry.boundingBox!;
}
