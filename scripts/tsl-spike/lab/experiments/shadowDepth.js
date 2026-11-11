/**
 * Does a node material's vertex stage reach `WebGLRenderer`'s shadow pass under the handler? A box
 * moves 3 units along x in its `positionNode`. The camera looks down, and the sun leans along z, so
 * the box's shadow lies beside it: at x = 0 when the depth pass misses the move, at x = 3 when not.
 */

import * as THREE from 'three';
import { WebGLNodesHandler } from 'three/addons/tsl/WebGLNodesHandler.js';
import { positionLocal, vec3 } from 'three/tsl';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { copyPixels, pixelAt } from '../pixels.js';

const GROUND_SIZE = 8;
const MOVED_BY = 3;
/** The ground point 1 unit past the box along the sun's lean, where a box 1 unit tall shades it. */
const SHADE_Z = 1;

function moved() {
  return positionLocal.add(vec3(MOVED_BY, 0, 0));
}

function groundPixel(canvas, x, z) {
  return [
    ((x + GROUND_SIZE / 2) / GROUND_SIZE) * canvas.width,
    ((z + GROUND_SIZE / 2) / GROUND_SIZE) * canvas.height,
  ];
}

function shadeAt(renderer, scene, camera) {
  renderer.render(scene, camera);
  const image = copyPixels(renderer.domElement);
  const read = (x, z) => pixelAt(image, ...groundPixel(renderer.domElement, x, z))[0];
  return { lit: read(-3, -3), whereTheBoxWas: read(0, SHADE_Z), whereTheBoxIs: read(MOVED_BY, SHADE_Z) };
}

/**
 * The shadow pass calls no `material.onBeforeRender` (r187 `WebGLShadowMap.js` `renderObject`), which
 * is where the handler updates a material's nodes, and the node frame holds the view camera
 * (`WebGLNodesHandler.js:404-409`). This updates the depth material's nodes with the shadow camera.
 */
function updateNodesInTheShadowPass(handler, mesh) {
  const viewCamera = () => handler.renderStack[handler.renderStack.length - 1].camera;
  mesh.onBeforeShadow = (renderer, object, camera, shadowCamera, geometry, depthMaterial) => {
    handler.nodeFrame.camera = shadowCamera;
    depthMaterial.onBeforeRender(renderer, null, shadowCamera, geometry, object);
  };
  mesh.onAfterShadow = () => {
    handler.nodeFrame.camera = viewCamera();
  };
}

export function run(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  const handler = new WebGLNodesHandler();
  renderer.setNodesHandler(handler);
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
    new MeshStandardNodeMaterial()
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  const boxMaterial = new MeshStandardNodeMaterial();
  boxMaterial.positionNode = moved();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), boxMaterial);
  box.position.y = 0.5;
  box.castShadow = true;
  // The box's bounds do not know the move.
  box.frustumCulled = false;
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(0, 10, -10);
  sun.castShadow = true;
  sun.shadow.camera.left = sun.shadow.camera.bottom = -6;
  sun.shadow.camera.right = sun.shadow.camera.top = 6;
  scene.add(ground, box, sun);

  const half = GROUND_SIZE / 2;
  const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 50);
  camera.position.set(0, 20, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);

  const withDefaultDepth = shadeAt(renderer, scene, camera);
  const depthMaterial = new MeshBasicNodeMaterial();
  depthMaterial.positionNode = moved();
  box.customDepthMaterial = depthMaterial;
  const withNodeDepth = shadeAt(renderer, scene, camera);
  updateNodesInTheShadowPass(handler, box);
  const withNodeDepthUpdated = shadeAt(renderer, scene, camera);
  return { withDefaultDepth, withNodeDepth, withNodeDepthUpdated };
}
