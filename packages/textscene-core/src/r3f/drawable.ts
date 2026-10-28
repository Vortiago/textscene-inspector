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
