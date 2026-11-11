/**
 * The spike's PointLight2D cookie quad on one of three backends, `?renderer=`, with the cookie,
 * colour and energy of `unit-pointlight2d.tscn`, added once to a cleared canvas. `run.mjs --out`
 * takes the picture to compare.
 */

/* global window */ // The page runs in the browser.

import * as THREE from 'three';
import { WebGLNodesHandler } from 'three/addons/tsl/WebGLNodesHandler.js';
import { WebGPURenderer } from 'three/webgpu';
import cookieUrl from '../../../../scenes/fixtures/textures/light2d.png?url';
import { accumulationState } from '../../../../packages/textscene-core/src/r3f/lighting2d/lightQuad.ts';
import { createLightQuadNodeMaterial } from '../../../../packages/textscene-core/src/r3f/tslSpike/lightQuadNodeMaterial.ts';

/** `Light2DBlendMode.ADD`. */
const BLEND_ADD = 0;

async function createRenderer(name, canvas) {
  if (name === 'handler') {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    const handler = new WebGLNodesHandler();
    // Godot's canvas adds the raw cookie texels, so no backend encodes the output.
    handler.getOutputCallback = (output) => output;
    renderer.setNodesHandler(handler);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    return renderer;
  }
  const renderer = new WebGPURenderer({ canvas, antialias: false, forceWebGL: name === 'webgl2' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  await renderer.init();
  return renderer;
}

export async function run(canvas) {
  const name = new URLSearchParams(window.location.search).get('renderer') ?? 'handler';
  const renderer = await createRenderer(name, canvas);
  const cookie = await new THREE.TextureLoader().loadAsync(cookieUrl);
  cookie.colorSpace = THREE.NoColorSpace;
  const material = createLightQuadNodeMaterial({
    cookie,
    color: { r: 1, g: 0.8, b: 0.4, a: 1 },
    energy: 2,
    edgeFade: 1,
    state: accumulationState(BLEND_ADD),
  });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.1, 0.1, 0.1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), material));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  camera.position.z = 1;
  renderer.setAnimationLoop(() => renderer.render(scene, camera));
  renderer.render(scene, camera);
  return { renderer: name };
}
