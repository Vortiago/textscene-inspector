/**
 * One canvas render of a test renderer's scene, as far as the scene cull sees it: the world matrices
 * update, `scene.onBeforeRender` fires, and React commits what the cull set.
 */

import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { fireSceneRender } from './fireSceneRender';
import { cameraLookingAt } from './threePasses';

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/** A camera at `position` looking at the origin, which R3F leaves as given (`manual`). */
export function manualCameraAt(position: THREE.Vector3Like): THREE.PerspectiveCamera {
  return Object.assign(cameraLookingAt(position), { manual: true });
}

/** Renders the scene through `camera` once: the cull sets each instance's draw state and fade for it. */
export async function renderScene(renderer: Renderer, camera: THREE.Camera): Promise<void> {
  const scene = renderer.scene.instance as THREE.Scene;
  scene.updateMatrixWorld();
  fireSceneRender(scene, camera);
  await ReactThreeTestRenderer.act(async () => {});
}
