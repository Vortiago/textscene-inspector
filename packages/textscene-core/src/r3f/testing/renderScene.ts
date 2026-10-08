/**
 * One canvas render of a test renderer's scene, as far as the scene cull sees it: the world matrices
 * update, `scene.onBeforeRender` fires, and React commits what the cull set.
 */

import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { fireSceneRender } from './fireSceneRender';

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/** A camera at `position` looking at the origin, which R3F leaves as given (`manual`). */
export function manualCameraAt(position: THREE.Vector3Like): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);
  camera.position.set(position.x, position.y, position.z);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  return Object.assign(camera, { manual: true });
}

/** Renders the scene through `camera` once, and commits the fade the cull sets. */
export async function renderScene(renderer: Renderer, camera: THREE.Camera): Promise<void> {
  const scene = renderer.scene.instance as THREE.Scene;
  scene.updateMatrixWorld();
  fireSceneRender(scene, camera);
  await ReactThreeTestRenderer.act(async () => {});
}

/** Whether `object` and each of its ancestors are visible. */
export function isRendered(object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) {
    if (!o.visible) return false;
  }
  return true;
}
