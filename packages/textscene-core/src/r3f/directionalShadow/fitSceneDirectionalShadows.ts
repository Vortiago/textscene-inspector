/**
 * Fits every declared, casting directional light in a scene to the camera about to render it.
 * It reads the current world matrices: `WebGLRenderer.render` updates them before it calls
 * `scene.onBeforeRender` (three r186 `WebGLRenderer.js:1663-1678`), where this runs.
 */

import * as THREE from 'three';
import { readDirectionalShadowDeclaration, type DirectionalShadowDeclaration } from './declaration.js';
import {
  fitDirectionalShadowBox,
  type DirectionalShadowBox,
  type ViewingCamera,
} from './fitDirectionalShadowBox.js';

interface DeclaredLight {
  light: THREE.DirectionalLight;
  declaration: DirectionalShadowDeclaration;
}

/**
 * A camera without a depth range (a bare `THREE.Camera`) fits nothing. A light without a
 * declaration, or that casts no shadow, keeps its shadow camera untouched.
 */
export function fitSceneDirectionalShadows(scene: THREE.Object3D, camera: THREE.Camera): void {
  if (!isViewingCamera(camera)) return;
  const lights = declaredCastingLights(scene);
  if (lights.length === 0) return;

  for (const { light, declaration } of lights) {
    const box = fitDirectionalShadowBox({
      camera,
      lightPosition: light.getWorldPosition(new THREE.Vector3()),
      targetPosition: light.target.getWorldPosition(new THREE.Vector3()),
      up: light.shadow.camera.up,
      declaration,
      shadowMapSize: light.shadow.mapSize.width,
    });
    if (box) applyShadowBox(light, box);
  }
}

function declaredCastingLights(scene: THREE.Object3D): DeclaredLight[] {
  const lights: DeclaredLight[] = [];
  scene.traverse((object) => {
    const light = object as THREE.DirectionalLight;
    if (!light.isDirectionalLight || !light.castShadow) return;
    const declaration = readDirectionalShadowDeclaration(light);
    if (declaration) lights.push({ light, declaration });
  });
  return lights;
}

function applyShadowBox(light: THREE.DirectionalLight, box: DirectionalShadowBox): void {
  const shadowCamera = light.shadow.camera;
  shadowCamera.left = box.left;
  shadowCamera.right = box.right;
  shadowCamera.top = box.top;
  shadowCamera.bottom = box.bottom;
  shadowCamera.near = box.near;
  shadowCamera.far = box.far;
  shadowCamera.updateProjectionMatrix();
  light.shadow.bias = box.bias;
  light.shadow.normalBias = box.normalBias;
}

function isViewingCamera(camera: THREE.Camera): camera is ViewingCamera {
  const candidate = camera as Partial<ViewingCamera>;
  return typeof candidate.near === 'number' && typeof candidate.far === 'number';
}
