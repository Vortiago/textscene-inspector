/** Where an instance sits, as the scene cull measures it, and the two ways a drawer places one. */

import * as THREE from 'three';
import type { RefObject } from 'react';
import type { Aabb } from '../../godot/aabb';
import type { Transform3D } from '../../nodes/base/node3d/types';
import { transform3DToMatrix } from '../nodeTreeTransforms';

export interface InstancePlacement {
  /** Writes the node's world transform as Godot holds it. False before the node mounts. */
  nodeMatrixWorld(target: THREE.Matrix4): boolean;
  /** Writes the instance's own AABB in node space. False before its geometry exists. */
  ownAabb(target: THREE.Box3): boolean;
}

/** Where an instance sits until its drawer places it: nowhere, so the cull cannot measure it. */
export const UNPLACED: InstancePlacement = Object.freeze({
  nodeMatrixWorld: () => false,
  ownAabb: () => false,
});

/** Writes a Godot AABB into a three box. */
export function copyAabb(target: THREE.Box3, { position, size }: Aabb): void {
  target.min.set(position.x, position.y, position.z);
  target.max.set(position.x + size.x, position.y + size.y, position.z + size.z);
}

/**
 * An instance whose mesh draws in the node's own space, under the node object's live pose: a
 * MeshInstance3D, or a CSG root, whose mesh is a child of its node group. A mesh with no vertices
 * yet, which is still loading or evaluating, has no box.
 */
export function livePlacement(
  nodeRef: RefObject<THREE.Object3D | null>,
  meshRef: RefObject<THREE.Mesh | null>
): InstancePlacement {
  return {
    nodeMatrixWorld: livePose(nodeRef),
    ownAabb(target) {
      const geometry = meshRef.current?.geometry;
      if (!geometry?.getAttribute('position')) return false;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      target.copy(geometry.boundingBox!);
      return true;
    },
  };
}

/** An instance whose box its data gives, or none, under the node object's live pose. */
export function boxPlacement(
  nodeRef: RefObject<THREE.Object3D | null>,
  ownAabb: Aabb | null
): InstancePlacement {
  return {
    nodeMatrixWorld: livePose(nodeRef),
    ownAabb(target) {
      if (ownAabb) copyAabb(target, ownAabb);
      return ownAabb !== null;
    },
  };
}

function livePose(nodeRef: RefObject<THREE.Object3D | null>): InstancePlacement['nodeMatrixWorld'] {
  return (target) => {
    const node = nodeRef.current;
    if (node) target.copy(node.matrixWorld);
    return node !== null;
  };
}

/**
 * An instance whose live pose a billboard or `fixed_size` rewrites every frame, which Godot's
 * instance transform never sees: its authored `transform` under its three parent, and `ownAabb`.
 */
export function authoredPlacement(
  objectRef: RefObject<THREE.Object3D | null>,
  transform: Transform3D | undefined,
  ownAabb: Aabb
): InstancePlacement {
  const local = transform ? transform3DToMatrix(transform) : new THREE.Matrix4();
  return {
    nodeMatrixWorld(target) {
      const parent = objectRef.current?.parent;
      if (!parent) return false;
      target.multiplyMatrices(parent.matrixWorld, local);
      return true;
    },
    ownAabb(target) {
      copyAabb(target, ownAabb);
      return true;
    },
  };
}
