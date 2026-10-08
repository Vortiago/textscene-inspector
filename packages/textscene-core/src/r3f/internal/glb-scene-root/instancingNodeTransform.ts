/**
 * The node that instances a GLB is the GLB's root in Godot. A `transform` that node writes replaces
 * the root's own, and the node draws it, so the root sits at its parent's origin. A
 * `GODOT_single_root` GLB's root is its glTF node 0, which otherwise keeps that node's transform.
 */

import { useLayoutEffect } from 'react';
import type * as THREE from 'three';

/** Puts `object`, the GLB root, at the origin while the instancing node writes a `transform`. */
export function useInstancingNodeTransform(
  object: THREE.Object3D | undefined,
  rawProperties: Readonly<Record<string, string>>
): void {
  const writesTransform = rawProperties['transform'] !== undefined;
  useLayoutEffect(() => {
    if (!object || !writesTransform) return;
    const position = object.position.clone();
    const quaternion = object.quaternion.clone();
    const scale = object.scale.clone();
    object.position.set(0, 0, 0);
    object.quaternion.identity();
    object.scale.set(1, 1, 1);
    object.updateMatrix();
    return () => {
      object.position.copy(position);
      object.quaternion.copy(quaternion);
      object.scale.copy(scale);
      object.updateMatrix();
    };
  }, [object, writesTransform]);
}
