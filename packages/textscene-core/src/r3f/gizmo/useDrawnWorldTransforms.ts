/**
 * The world transforms of the nodes a gizmo reads at live paths, as the previewer draws them: the
 * object `NodeDispatcher` mounts for each path, with its ancestors, instances and GLB frames. A
 * path whose node is not mounted, or is no Node3D, reads as null.
 */

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Transform3D } from '../../godot/math/transform3d.js';
import { sameTransform3D } from '../../godot/math/transform3d.js';
import { lookupDrawnObjects, type DrawnObjects, type Paths } from '../drawnObjects.js';
import { useOptionalSelection } from '../contexts/SelectionContext.js';
import { realGlobalTransform3D } from '../nodeTreeTransforms.js';

type Transforms = readonly (Transform3D | null)[];

function sameTransforms(a: Transforms, b: Transforms): boolean {
  return a.length === b.length && a.every((transform, i) => sameOptionalTransform(transform, b[i]!));
}

function sameOptionalTransform(a: Transform3D | null, b: Transform3D | null): boolean {
  return a === null || b === null ? a === b : sameTransform3D(a, b);
}

/** The transform of each tracked object, and the world matrix it was read at. */
interface ReadAt {
  objects: DrawnObjects['objects'];
  elements: (number[] | null)[];
  transforms: (Transform3D | null)[];
}

/**
 * The world transform of the node at each live path, null for a path that names nothing drawn.
 * The transforms re-read every frame, since an animation moves a node with no render of its owner,
 * and the hook sets state only when one changes.
 */
export function useDrawnWorldTransforms(paths: Paths): Transforms {
  const registry = useOptionalSelection()?.nodeObjectMap ?? null;
  const [transforms, setTransforms] = useState<Transforms>([]);
  const lookup = useRef<DrawnObjects | null>(null);
  // The world matrix each transform was read at, so a frame where nothing moved builds no transform.
  const read = useRef<ReadAt | null>(null);

  useFrame(() => {
    if (registry === null) return;
    lookup.current = lookupDrawnObjects(registry, paths, lookup.current);
    const { objects } = lookup.current;
    if (read.current?.objects !== objects) {
      read.current = { objects, elements: objects.map(() => null), transforms: objects.map(() => null) };
    }
    const { elements, transforms: readTransforms } = read.current;
    let hasMoved = false;
    objects.forEach((object, i) => {
      if (object === null) return;
      object.updateWorldMatrix(true, false);
      const now = object.matrixWorld.elements;
      if (elements[i]?.every((value, j) => value === now[j])) return;
      elements[i] = [...now];
      readTransforms[i] = realGlobalTransform3D(object);
      hasMoved = true;
    });
    if (hasMoved || transforms.length !== objects.length) {
      const next = [...readTransforms];
      setTransforms((previous) => (sameTransforms(previous, next) ? previous : next));
    }
  });

  return transforms;
}
