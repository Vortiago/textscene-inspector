import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { directionalShadowUserData } from './declaration';
import { fitSceneDirectionalShadows } from './fitSceneDirectionalShadows';

const DECLARATION = { maxDistance: 80, pancakeSize: 20, depthBias: -0.002, normalBias: 2 };

function viewingCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 4000);
  camera.position.set(0, 10, 40);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

function sceneWithSun(options: { declared: boolean; casts: boolean }): {
  scene: THREE.Scene;
  light: THREE.DirectionalLight;
} {
  const scene = new THREE.Scene();
  const light = new THREE.DirectionalLight();
  light.position.set(10, 20, 5);
  light.castShadow = options.casts;
  if (options.declared) light.userData = directionalShadowUserData(DECLARATION);
  scene.add(light, light.target);
  // `WebGLRenderer.render` updates the world matrices before the hook that runs the fit.
  scene.updateMatrixWorld();
  return { scene, light };
}

/** A shadow camera as three constructs it, before anything fits it. */
const UNFITTED = new THREE.DirectionalLight().shadow.camera;

describe('fitSceneDirectionalShadows', () => {
  it('fits a declared, casting light to the camera', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: true });
    fitSceneDirectionalShadows(scene, viewingCamera());
    const shadowCamera = light.shadow.camera;
    expect(shadowCamera.right - shadowCamera.left).toBeGreaterThan(80);
    const threeDepth = shadowCamera.far - shadowCamera.near;
    const godotDepth = (threeDepth - DECLARATION.pancakeSize) / 2 + DECLARATION.pancakeSize;
    expect(light.shadow.bias).toBeCloseTo((DECLARATION.depthBias * godotDepth) / threeDepth, 12);
  });

  it('leaves a light without a declaration alone', () => {
    const { scene, light } = sceneWithSun({ declared: false, casts: true });
    fitSceneDirectionalShadows(scene, viewingCamera());
    expect(light.shadow.camera.left).toBe(UNFITTED.left);
    expect(light.shadow.camera.far).toBe(UNFITTED.far);
    expect(light.shadow.bias).toBe(0);
  });

  it('leaves a declared light that casts no shadow alone (edge case)', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: false });
    fitSceneDirectionalShadows(scene, viewingCamera());
    expect(light.shadow.camera.left).toBe(UNFITTED.left);
  });

  it('fits nothing for a camera without a depth range (error case)', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: true });
    fitSceneDirectionalShadows(scene, new THREE.Camera());
    expect(light.shadow.camera.left).toBe(UNFITTED.left);
  });

  it('follows the camera when it moves', () => {
    const { scene, light } = sceneWithSun({ declared: true, casts: true });
    const camera = viewingCamera();
    fitSceneDirectionalShadows(scene, camera);
    const before = light.shadow.camera.left;
    camera.position.x += 500;
    camera.updateMatrixWorld();
    fitSceneDirectionalShadows(scene, camera);
    expect(light.shadow.camera.left).not.toBeCloseTo(before, 3);
  });
});
