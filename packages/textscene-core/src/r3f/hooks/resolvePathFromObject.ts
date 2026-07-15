/**
 * Resolves the TSCN node path that owns a raycasted THREE.Object3D, for the
 * viewport's event-delegated pointer picking.
 *
 * Before this, every node's wrapper `<group>` carried its OWN
 * onPointerDown/Up/Over/Out handlers — R3F's picker treats every object with
 * a registered handler as its own interactive raycast root, so a mesh at
 * depth d got triangle-tested once per ANCESTOR wrapper on every pointer
 * move (O(meshes × depth)). Attaching ONE set of handlers to a single root
 * group instead means R3F raycasts the whole subtree exactly once; this
 * function recovers "which node was hit" from the event's `object` (the
 * nearest intersected mesh) by walking its OWN THREE parent chain — no R3F
 * event bubbling involved — checking a reverse `WeakMap<Object3D, path>`
 * (`SelectionContext.objectPathMap`, populated by the same
 * `registerNodeObject` calls that already build the forward
 * path→Object3D `nodeObjectMap`).
 *
 * A child node's own wrapper is closer to the hit mesh than any ancestor
 * node's wrapper, so walking up and returning the FIRST match reproduces the
 * historical "innermost wrapper wins" behavior (R3F used to bubble from the
 * hit mesh outward through nested handlers, and each handler called
 * `stopPropagation()`).
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
