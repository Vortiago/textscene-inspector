/**
 * Resolves the node path that owns a raycast hit, for the viewport's single set of pointer
 * handlers. R3F treats each object with a handler as its own raycast root, so per-wrapper
 * handlers cost O(meshes × depth) per move. This walks the hit's THREE parent chain against
 * `SelectionContext.objectPathMap`, and the first match is the innermost wrapper, which wins.
 */
import type * as THREE from 'three';

export function resolvePathFromObject(
  object: THREE.Object3D | null | undefined,
  objectPathMap: WeakMap<THREE.Object3D, string>
): string | null {
  let current: THREE.Object3D | null | undefined = object;
  while (current) {
    const path = objectPathMap.get(current);
    if (path !== undefined) return path;
    current = current.parent;
  }
  return null;
}
