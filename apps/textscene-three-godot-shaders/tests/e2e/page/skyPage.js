import * as THREE from 'three';
import { transpileSky, writeSkyBindings } from '@textscene/three-godot-shaders';
import { framePixels } from './framePixels.js';
import { displayRenderer, euler, godotCamera, linear, shaderTime } from './godotView.js';

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
  const camera = godotCamera(spec);
  const fog = spec.fog && {
    lightColor: linear(spec.fog.color),
    lightEnergy: spec.fog.energy,
    sunScatter: spec.fog.sunScatter,
    skyAffect: spec.fog.skyAffect,
    aerialPerspective: spec.fog.aerialPerspective,
    density: 0.01,
  };
  writeSkyBindings(sky, {
    camera,
    time: shaderTime(spec.clock),
    brightness: 1,
    fog,
    lights: spec.lights.map(skyLight),
  });
  const scene = new THREE.Scene();
  scene.add(sky.mesh);
  const pixels = framePixels(displayRenderer, scene, camera, {
    width,
    height,
    colorSpace: THREE.SRGBColorSpace,
  });
  sky.mesh.material.dispose();
  return { pixels: Array.from(opaque(pixels)) };
}

/** Godot's viewport with no transparent background reads opaque, and the sky writes alpha 0. */
function opaque(pixels) {
  for (let alpha = 3; alpha < pixels.length; alpha += 4) pixels[alpha] = 255;
  return pixels;
}

globalThis.drawSky = drawSky;
