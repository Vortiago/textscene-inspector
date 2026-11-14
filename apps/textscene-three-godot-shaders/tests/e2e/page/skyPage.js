/**
 * The sky page: a plain three.js page that draws a transpiled sky shader as a scene's background,
 * with the camera, fog and directional lights of a sky scene, and answers the RGBA8 pixels, top
 * row first, as Godot's image holds them.
 */

import * as THREE from 'three';
import { installNodesHandler, transpileSky, writeSkyBindings } from '@textscene/three-godot-shaders';

const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
installNodesHandler(renderer, 'display');
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

/** Godot's rotation in degrees, in Godot's order of axes: Y, then X, then Z. */
const euler = ([x, y, z]) => new THREE.Euler(...[x, y, z].map(THREE.MathUtils.degToRad), 'YXZ');

/** A colour Godot holds in sRGB, linear, as Godot's C++ converts it for the sky. */
const linear = ([r, g, b]) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

function skyLight(light) {
  const direction = new THREE.Vector3(0, 0, 1).applyEuler(euler(light.rotation)).normalize();
  const color = linear(light.color);
  return { direction, energy: light.energy, color, size: THREE.MathUtils.degToRad(light.size) };
}

/** The pixels of `scene`'s sky, or `{ error }` when the transpilation refuses it. */
function drawSky(spec) {
  let sky;
  try {
    sky = transpileSky(spec.source);
  } catch (error) {
    return { error: String(error.message ?? error) };
  }
  const { width, height } = spec;
  // Godot's defaults: the near and far planes of Camera3D.
  const camera = new THREE.PerspectiveCamera(spec.camera.fov, width / height, 0.05, 4000);
  camera.rotation.copy(euler(spec.camera.rotation));
  camera.updateMatrixWorld();
  const fog = spec.fog && {
    lightColor: linear(spec.fog.color),
    lightEnergy: spec.fog.energy,
    sunScatter: spec.fog.sunScatter,
    skyAffect: spec.fog.skyAffect,
    aerialPerspective: spec.fog.aerialPerspective,
    density: 0.01,
  };
  writeSkyBindings(sky, { camera, time: 0, brightness: 1, fog, lights: spec.lights.map(skyLight) });
  const scene = new THREE.Scene();
  scene.add(sky.mesh);
  const target = new THREE.WebGLRenderTarget(width, height);
  target.texture.colorSpace = THREE.SRGBColorSpace;
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  const pixels = new Uint8Array(width * height * 4);
  renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
  renderer.setRenderTarget(null);
  target.dispose();
  sky.mesh.material.dispose();
  return { pixels: Array.from(opaque(topRowFirst(pixels, width, height))) };
}

/** Godot's viewport with no transparent background reads opaque, and the sky writes alpha 0. */
function opaque(pixels) {
  for (let alpha = 3; alpha < pixels.length; alpha += 4) pixels[alpha] = 255;
  return pixels;
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

globalThis.drawSky = drawSky;
