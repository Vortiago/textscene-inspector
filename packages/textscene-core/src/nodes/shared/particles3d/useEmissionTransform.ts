/** The global transform of a particle node, which a world-space emitter emits from. */

import { useLayoutEffect, useState, type RefObject } from 'react';
import type * as THREE from 'three';
import { sameTransform3D, type Transform3D } from '../../../godot/math/transform3d';
import type { TscnNode } from '../../../parser/types';
import { realGlobalTransform3D } from '../../../r3f/nodeTreeTransforms';

/**
 * The emitter's global transform: a `local_coords = false` emitter emits from it, and a VIEW_DEPTH
 * emitter sorts through its inverse. three holds the ancestors, so it is sampled again for each
 * parse of the node, and changes identity only when it changes. Null until the first sample, so the emitter
 * settles once on mount, from the transform it draws under.
 */
export function useEmissionTransform(
  nodeRef: RefObject<THREE.Object3D | null>,
  parsed: TscnNode
): Transform3D | null {
  const [transform, setTransform] = useState<Transform3D | null>(null);
  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    // A layout pass runs before the renderer's own `updateMatrixWorld`, so the ancestors refresh.
    node.updateWorldMatrix(true, false);
    const next = realGlobalTransform3D(node);
    setTransform((previous) => (previous && sameTransform3D(previous, next) ? previous : next));
  }, [nodeRef, parsed]);
  return transform;
}
