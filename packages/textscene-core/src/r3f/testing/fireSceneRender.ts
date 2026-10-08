/** Replays the hook `WebGLRenderer.render` runs on a scene before it builds its render list. */

import type * as THREE from 'three';

/** Fires `scene.onBeforeRender` as a render through `camera` into `target` does. */
export function fireSceneRender(
  scene: THREE.Object3D,
  camera: THREE.Camera,
  target: THREE.WebGLRenderTarget | null = null
): void {
  // `WebGLRenderer.render` passes the target where `Object3D`'s signature names a geometry.
  scene.onBeforeRender(
    null as unknown as THREE.WebGLRenderer,
    scene as THREE.Scene,
    camera,
    target as unknown as THREE.BufferGeometry,
    null as unknown as THREE.Material,
    null as unknown as THREE.Group
  );
}
