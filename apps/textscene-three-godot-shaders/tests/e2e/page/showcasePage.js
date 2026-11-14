/**
 * The showcase page: a plain three.js page that draws a transpiled function of UV to colour on a
 * full-frame quad, and answers the RGBA8 pixels, top row first, as Godot's image holds them.
 */

import * as THREE from 'three';
import { NodeMaterial } from 'three/webgpu';
import { screenCoordinate, screenSize, vec4 } from 'three/tsl';
import { installNodesHandler, transpileShadingLanguage } from '@textscene/three-godot-shaders';

const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
installNodesHandler(renderer, 'linear');
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
const scene = new THREE.Scene();
scene.add(quad);

/**
 * Godot's UV of a ColorRect that fills its viewport: (0, 0) at the top left corner, read at the
 * pixel centre. three's screen coordinate starts at the top left too.
 */
const uv = screenCoordinate.div(screenSize);

/** The pixels of `showcase`'s function, or `{ error }` when the transpilation refuses it. */
function drawShowcase(showcase) {
  let pattern;
  try {
    pattern = transpileShadingLanguage(showcase.source).functions.get('pattern');
    if (!pattern) return { error: 'the transpilation has no function pattern' };
  } catch (error) {
    return { error: String(error.message ?? error) };
  }
  const material = new NodeMaterial();
  material.fragmentNode = vec4(pattern.call([uv]), 1);
  quad.material = material;
  const { width, height } = showcase;
  const target = new THREE.WebGLRenderTarget(width, height);
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  const pixels = new Uint8Array(width * height * 4);
  renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
  renderer.setRenderTarget(null);
  target.dispose();
  material.dispose();
  return { pixels: Array.from(topRowFirst(pixels, width, height)) };
}

/** GL reads the bottom row first, and Godot's image holds the top row first. */
function topRowFirst(pixels, width, height) {
  const rowBytes = width * 4;
  const flipped = new Uint8Array(pixels.length);
  for (let row = 0; row < height; row += 1) {
    flipped.set(pixels.subarray(row * rowBytes, (row + 1) * rowBytes), (height - 1 - row) * rowBytes);
  }
  return flipped;
}

globalThis.drawShowcase = drawShowcase;
