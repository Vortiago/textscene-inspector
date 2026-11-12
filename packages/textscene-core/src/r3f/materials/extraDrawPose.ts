/**
 * Holds an extra draw at the pose of its geometry instance's node while the leaf's own
 * draw is billboarded or fixed in size. Godot's billboard and `fixed_size` are flags of the leaf's
 * own material (`sprite_3d.cpp:299`, `label_3d.cpp:396`), so a draw with another material ignores
 * both.
 */

import type { RefObject } from 'react';
import * as THREE from 'three';
import type { DrawnInstance } from '../surfaceDrawHooks';

/** A leaf whose own draw a node billboard or `fixed_size` moves away from the node's pose. */
export interface PosedLeaf {
  /** The instance, which holds the node's world transform as Godot holds it. */
  instance: DrawnInstance;
  /** The object the leaf's billboard or `fixed_size` moves, at or above its surface draws. */
  posedRef: RefObject<THREE.Object3D | null>;
}

/** Scratch for one `updateMatrixWorld` call. */
const belowPosed = new THREE.Matrix4();

/**
 * Keeps `object` where the surface it covers sits under the node's own transform, whatever moved
 * `posedRef`'s object. Returns the release, which hands `object` back to three's own update.
 */
export function drawAtNodePose(object: THREE.Object3D, { instance, posedRef }: PosedLeaf): () => void {
  object.updateMatrixWorld = function updateMatrixWorldAtNodePose(force?: boolean): void {
    const posed = posedRef.current;
    if (!posed || !instance.nodeMatrixWorld(this.matrixWorld)) {
      THREE.Object3D.prototype.updateMatrixWorld.call(this, force);
      return;
    }
    if (this.matrixAutoUpdate) this.updateMatrix();
    belowPosed.copy(this.matrix);
    for (let above = this.parent; above && above !== posed; above = above.parent) {
      belowPosed.premultiply(above.matrix);
    }
    this.matrixWorld.multiply(belowPosed);
  };
  return () => {
    delete (object as Partial<THREE.Object3D>).updateMatrixWorld;
  };
}
