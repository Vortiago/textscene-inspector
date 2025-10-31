/**
 * Three.js scene initialization utilities.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface SceneComponents {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
}

/**
 * Creates and configures a default THREE.Scene with lighting and grid.
 */
export function createDefaultScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2a2a);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 10, 10);
  scene.add(directionalLight);

  const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
  scene.add(gridHelper);

  return scene;
}

/**
 * Creates and positions a default perspective camera.
 */
export function createDefaultCamera(canvas: HTMLCanvasElement): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(
    75,
    canvas.width / canvas.height,
    0.1,
    1000
  );
  camera.position.set(10, 10, 10);
  camera.lookAt(0, 0, 0);

  return camera;
}

/**
 * Creates and configures a WebGL renderer.
 */
export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
  });
  renderer.setSize(canvas.width, canvas.height);

  return renderer;
}

/**
 * Creates and configures orbit controls.
 */
export function createOrbitControls(camera: THREE.Camera, canvas: HTMLCanvasElement): OrbitControls {
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  return controls;
}

/**
 * Sets up complete three.js scene with all default components.
 * Convenience function that calls all setup functions and returns components.
 */
export function setupThreeJsScene(canvas: HTMLCanvasElement): SceneComponents {
  const scene = createDefaultScene();
  const camera = createDefaultCamera(canvas);
  const renderer = createRenderer(canvas);
  const controls = createOrbitControls(camera, canvas);

  return { scene, camera, renderer, controls };
}
