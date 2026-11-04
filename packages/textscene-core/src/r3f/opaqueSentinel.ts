/**
 * Groups that three draws before and after every other surface of the opaque list, so a pass of
 * Godot's that runs before its opaque pass, or a state that ends with it, runs there, with the
 * render's lights and shadow maps set up.
 */

import * as THREE from 'three';
import { NO_RAYCAST } from './materials/materialOverlay';

/**
 * The extremes of a group order and of a `renderOrder`. A gizmo Group takes the top group order
 * too, so the mesh's own order breaks that tie in the sentinel's favour.
 */
const FIRST_OPAQUE_RENDER_ORDER = Number.MIN_SAFE_INTEGER;
const LAST_OPAQUE_RENDER_ORDER = Number.MAX_SAFE_INTEGER;

type Reach = (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => void;

/**
 * A Group whose one mesh runs `reach` each time three reaches it in a render. three sorts the opaque
 * list by the nearest Group's `renderOrder` first (`WebGLRenderLists.js` `painterSortStable`), and
 * takes a Group's order only where the Group is in the camera's layers (r187 `WebGLRenderer.js:1877-1883`).
 * The mesh draws nothing of its own, casts nothing and takes no pick.
 */
class OpaqueSentinel extends THREE.Group {
  readonly mesh = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false })
  );

  constructor(name: string, renderOrder: number, reach: Reach) {
    super();
    this.name = name;
    this.renderOrder = renderOrder;
    this.layers.enableAll();
    this.matrixAutoUpdate = false;
    const { mesh } = this;
    mesh.renderOrder = renderOrder;
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    mesh.layers.enableAll();
    mesh.userData = { tscnFrameExcluded: true };
    mesh.raycast = NO_RAYCAST;
    mesh.onBeforeRender = reach;
    this.add(mesh);
  }

  /** Frees the mesh's geometry and material. */
  override dispose(): void {
    super.dispose();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

export type { OpaqueSentinel };

/**
 * A sentinel named `name` that three reaches first in the opaque list.
 *
 * @canonical A sentinel three draws first in the opaque list
 */
export function createFirstOpaqueSentinel(name: string, reach: Reach): OpaqueSentinel {
  return new OpaqueSentinel(name, FIRST_OPAQUE_RENDER_ORDER, reach);
}

/**
 * A sentinel named `name` that three reaches last in the opaque list: after it, three draws its
 * transmissive and transparent lists, Godot's alpha pass.
 *
 * @canonical A sentinel three draws last in the opaque list
 */
export function createLastOpaqueSentinel(name: string, reach: Reach): OpaqueSentinel {
  return new OpaqueSentinel(name, LAST_OPAQUE_RENDER_ORDER, reach);
}
