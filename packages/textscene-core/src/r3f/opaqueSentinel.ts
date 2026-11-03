/**
 * Meshes that three draws before and after every other surface of the opaque list, so a pass of
 * Godot's that runs before its opaque pass, or a state that ends with it, runs there, with the
 * render's lights and shadow maps set up.
 */

import * as THREE from 'three';

/** Below and above every `render_priority` (`material.h:66-67`), so three's opaque sort puts them at the ends. */
const FIRST_OPAQUE_RENDER_ORDER = Number.MIN_SAFE_INTEGER;
const LAST_OPAQUE_RENDER_ORDER = Number.MAX_SAFE_INTEGER;

type Reach = (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => void;

/**
 * A sentinel named `name` that runs `reach` each time three reaches it in a render, first in the
 * opaque list. It draws nothing of its own, casts nothing and takes no pick.
 *
 * @canonical A sentinel three draws first in the opaque list
 */
export function createFirstOpaqueSentinel(name: string, reach: Reach): THREE.Mesh {
  return createSentinel(name, FIRST_OPAQUE_RENDER_ORDER, reach);
}

/**
 * A sentinel as {@link createFirstOpaqueSentinel} makes, last in the opaque list: after it, three
 * draws its transmissive and transparent lists, Godot's alpha pass.
 *
 * @canonical A sentinel three draws last in the opaque list
 */
export function createLastOpaqueSentinel(name: string, reach: Reach): THREE.Mesh {
  return createSentinel(name, LAST_OPAQUE_RENDER_ORDER, reach);
}

function createSentinel(name: string, renderOrder: number, reach: Reach): THREE.Mesh {
  const sentinel = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false })
  );
  sentinel.name = name;
  sentinel.renderOrder = renderOrder;
  sentinel.frustumCulled = false;
  sentinel.layers.enableAll();
  sentinel.userData = { tscnFrameExcluded: true };
  sentinel.raycast = () => {};
  sentinel.onBeforeRender = (renderer, scene, camera) => reach(renderer, scene, camera);
  return sentinel;
}

/** Frees what a sentinel's maker made. */
export function disposeOpaqueSentinel(sentinel: THREE.Mesh): void {
  sentinel.geometry.dispose();
  (sentinel.material as THREE.Material).dispose();
}
