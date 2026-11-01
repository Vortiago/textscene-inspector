/**
 * The world transforms of the nodes a gizmo reads at live paths, as the previewer draws them: the
 * object `NodeDispatcher` mounts for each path, with its ancestors, instances and GLB frames. A
 * path whose node is not mounted, or is no Node3D, reads as null.
 */

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { Transform3D } from '../../godot/math/transform3d.js';
import { sameTransform3D } from '../../godot/math/transform3d.js';
import { trackTargetFinder } from '../animation/trackTargets.js';
import { useOptionalSelection } from '../contexts/SelectionContext.js';
import { realGlobalTransform3D } from '../nodeTreeTransforms.js';

type Transforms = readonly (Transform3D | null)[];

function sameTransforms(a: Transforms, b: Transforms): boolean {
  return a.length === b.length && a.every((transform, i) => sameOptionalTransform(transform, b[i]!));
}

function sameOptionalTransform(a: Transform3D | null, b: Transform3D | null): boolean {
  return a === null || b === null ? a === b : sameTransform3D(a, b);
}

type Paths = readonly (string | null)[];

/** The objects found for `paths`, and the registry size they were found at. */
interface Lookup {
  paths: Paths;
  registrySize: number;
  objects: readonly (THREE.Object3D | null)[];
}

function isDetached(object: THREE.Object3D | null): boolean {
  return object !== null && object.parent === null;
}

/**
 * `previous` while it holds: the same paths, the registry no larger or smaller, every object still
 * mounted. A lookup walks every registered wrapper, and a path with no node would repeat it each frame.
 */
function lookupObjects(
  registry: ReadonlyMap<string, THREE.Object3D>,
  paths: Paths,
  previous: Lookup | null
): Lookup {
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

/**
 * The world transform of the node at each live path, null for a path that names nothing drawn.
 * The transforms re-read every frame, since an animation moves a node with no render of its owner,
 * and the hook sets state only when one changes.
 */
export function useDrawnWorldTransforms(paths: Paths): Transforms {
  const registry = useOptionalSelection()?.nodeObjectMap ?? null;
  const [transforms, setTransforms] = useState<Transforms>([]);
  const lookup = useRef<Lookup | null>(null);

  useFrame(() => {
    if (registry === null) return;
    lookup.current = lookupObjects(registry, paths, lookup.current);
    const next = lookup.current.objects.map((object) => {
      if (object === null) return null;
      object.updateWorldMatrix(true, false);
      return realGlobalTransform3D(object);
    });
    setTransforms((previous) => (sameTransforms(previous, next) ? previous : next));
  });

  return transforms;
}
