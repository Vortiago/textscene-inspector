/**
 * A mesh that three draws before every other surface of the opaque list, so a pass of Godot's that
 * runs before its opaque pass can run there, with the render's lights and shadow maps set up.
 */

import * as THREE from 'three';

/** Below every `render_priority` (`material.h:66-67`), so three's opaque sort puts it first. */
const FIRST_OPAQUE_RENDER_ORDER = Number.MIN_SAFE_INTEGER;

/**
 * A sentinel named `name` that runs `reach` each time three reaches it in a render. It draws nothing
 * of its own, casts nothing and takes no pick.
 *
 * @canonical A sentinel three draws first in the opaque list
 */
export function createFirstOpaqueSentinel(
  name: string,
  reach: (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => void
): THREE.Mesh {
  const sentinel = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false })
  );
  sentinel.name = name;
  sentinel.renderOrder = FIRST_OPAQUE_RENDER_ORDER;
  sentinel.frustumCulled = false;
  sentinel.layers.enableAll();
  sentinel.userData = { tscnFrameExcluded: true };
  sentinel.raycast = () => {};
  sentinel.onBeforeRender = (renderer, scene, camera) => reach(renderer, scene, camera);
  return sentinel;
}

/** Frees what `createFirstOpaqueSentinel` made. */
export function disposeFirstOpaqueSentinel(sentinel: THREE.Mesh): void {
  sentinel.geometry.dispose();
  (sentinel.material as THREE.Material).dispose();
}
