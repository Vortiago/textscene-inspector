/**
 * The ways a harness can read what `WebGPURenderer` drew: a 2D copy of the canvas in the task that
 * drew it, the renderer's own read of a target, and a screenshot, which `run.mjs --out` takes.
 * `?backend=webgl2` forces the WebGL 2 backend.
 */

/* global window */ // The page runs in the browser.

import * as THREE from 'three';
import { MeshBasicNodeMaterial, RenderTarget, WebGPURenderer } from 'three/webgpu';
import { copyPixels, pixelAt } from '../pixels.js';

export async function run(canvas) {
  const forceWebGL = new URLSearchParams(window.location.search).get('backend') === 'webgl2';
  const renderer = new WebGPURenderer({ canvas, antialias: false, forceWebGL });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  await renderer.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.25, 0.5, 0.75);
  const material = new MeshBasicNodeMaterial({ color: new THREE.Color(1, 0.5, 0) });
  const box = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  box.position.set(-0.5, 0.5, 0);
  scene.add(box);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  camera.position.z = 1;

  renderer.render(scene, camera);
  const copied = copyPixels(canvas);

  const target = new RenderTarget(canvas.width, canvas.height);
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  const read = await renderer.readRenderTargetPixelsAsync(target, 0, 0, canvas.width, canvas.height);
  const readAt = (x, y) => [...read.slice((y * canvas.width + x) * 4, (y * canvas.width + x) * 4 + 3)];

  // A screenshot reads what the page presents, so the page keeps drawing after it reports.
  renderer.setAnimationLoop(() => renderer.render(scene, camera));

  // The quad is the canvas's top-left quarter.
  return {
    backend: renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2',
    canvasCopy: { topLeft: pixelAt(copied, 64, 64), bottomRight: pixelAt(copied, 192, 192) },
    targetRead: { row64: readAt(64, 64), row192: readAt(64, 192), bytes: read.constructor.name },
  };
}
