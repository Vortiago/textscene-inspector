/**
 * The objects the previewer draws for nodes at live paths: the object `NodeDispatcher` mounts for
 * each path, with its ancestors, instances and GLB frames, found through the node-object registry
 * an AnimationPlayer binds through too.
 */

import type * as THREE from 'three';
import { trackTargetFinder } from './animation/trackTargets.js';

/** Live paths, where null asks for nothing. */
export type Paths = readonly (string | null)[];

/** The objects found for `paths`, and the registry size they were found at. */
export interface DrawnObjects {
  paths: Paths;
  registrySize: number;
  /** The drawn object at each path, null where nothing is mounted for it. */
  objects: readonly (THREE.Object3D | null)[];
}

function isDetached(object: THREE.Object3D | null): boolean {
  return object !== null && object.parent === null;
}

/**
 * The objects at `paths`, or `previous` while it holds: the same paths, the registry no larger or
 * smaller, every object still mounted. A lookup walks every registered wrapper, and a path with no
 * node would repeat it each frame.
 *
 * @canonical The drawn objects at live paths
 */
export function lookupDrawnObjects(
  registry: ReadonlyMap<string, THREE.Object3D>,
  paths: Paths,
  previous: DrawnObjects | null
): DrawnObjects {
  const holds =
    previous !== null &&
    previous.registrySize === registry.size &&
    previous.paths.length === paths.length &&
    previous.paths.every((path, i) => path === paths[i]) &&
    !previous.objects.some(isDetached);
  if (holds) return previous;
  const find = trackTargetFinder(registry);
  return {
    paths,
    registrySize: registry.size,
    objects: paths.map((path) => (path === null ? null : find(path))),
  };
}
