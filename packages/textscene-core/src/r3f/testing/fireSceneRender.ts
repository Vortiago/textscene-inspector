/** Replays the hooks `WebGLRenderer.render` runs on a scene before it builds its render list and after it draws. */

import * as THREE from 'three';

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

/** Fires `scene.onAfterRender` as a render through `camera` does once it has drawn the scene. */
export function fireSceneRenderEnd(scene: THREE.Object3D, camera: THREE.Camera): void {
  scene.onAfterRender(
    null as unknown as THREE.WebGLRenderer,
    scene as THREE.Scene,
    camera,
    null as unknown as THREE.BufferGeometry,
    null as unknown as THREE.Material,
    null as unknown as THREE.Group
  );
}

/** Fires a render of `scene` through a camera `distance` along +Z, with world matrices current. */
export function fireSceneRenderFrom(scene: THREE.Scene, distance: number): void {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, distance);
  camera.updateMatrixWorld();
  scene.updateMatrixWorld();
  fireSceneRender(scene, camera);
}
