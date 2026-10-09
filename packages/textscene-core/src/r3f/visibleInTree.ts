/** Godot's `is_visible_in_tree()` over three's scene graph, which draws nothing under a hidden ancestor. */

import type * as THREE from 'three';

/** Whether `object` and each of its ancestors are visible. */
export function visibleInTree(object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) {
    if (!o.visible) return false;
  }
  return true;
}
