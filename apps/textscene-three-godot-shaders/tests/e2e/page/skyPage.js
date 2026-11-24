import * as THREE from 'three';
import {
  bindRadiance,
  skyMaterialShader,
  SkyResolutionPasses,
  textToVariant,
  transpileSky,
  writeSkyBindings,
} from '@textscene/three-godot-shaders';
import { framePixels } from './framePixels.js';
import { displayRenderer, godotCamera, lightAxis, linear, shaderTime } from './godotView.js';

function skyLight(light) {
  const direction = lightAxis(light.rotation);
  const color = linear(light.color);
  return { direction, energy: light.energy, color, size: THREE.MathUtils.degToRad(light.size) };
}

/** Godot's radiance array at size 256: 64 px of border on each side of 512 (`sky.cpp:1551-1569`). */
const RADIANCE_OCTMAP = { size: 640, layers: 8, borderSize: 1 - (64 * 2) / 640 };

/** Draws the sky's octmap pass as Godot draws layer 0 of its radiance (`sky.cpp:1330`), lit by `lights`. */
function radianceOf(source, lights) {
  const octmap = transpileSky(source, { pass: 'octmap' });
  const camera = new THREE.PerspectiveCamera(90, 1, 0.01, 10);
  writeSkyBindings(octmap, {
    camera,
    time: 0,
    brightness: 1,
    lights,
    borderSize: RADIANCE_OCTMAP.borderSize,
  });
  const { size, layers } = RADIANCE_OCTMAP;
  const target = new THREE.WebGLArrayRenderTarget(size, size, layers, {
    type: THREE.HalfFloatType,
    depthBuffer: false,
    minFilter: THREE.LinearFilter,
  });
  const scene = new THREE.Scene();
  scene.add(octmap.mesh);
  displayRenderer.setRenderTarget(target, 0);
  displayRenderer.render(scene, camera);
  displayRenderer.setRenderTarget(null);
  disposeDraw(octmap);
  return target;
}

/** The sky of a scene's shader, or of its sky material class through the shader Godot generates for it. */
function sceneSky({ source, material }) {
  if (!material) return transpileSky(source);
  const properties = Object.fromEntries(
    Object.entries(material.properties).map(([name, text]) => [name, textToVariant(text)])
  );
  const shader = skyMaterialShader(material.class, { properties, textures: new Set() });
  if (!shader) throw new Error(`expected a sky material class, got ${material.class}`);
  const sky = transpileSky(shader.code);
  for (const [name, value] of Object.entries(shader.parameters)) sky.parameters.get(name)?.set(value);
  return sky;
}

/** The pixels of `scene`'s sky, or `{ error }` when the transpilation refuses it. */
function drawSky(spec) {
  let sky;
  try {
    sky = sceneSky(spec);
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
  const lights = spec.lights.map(skyLight);
  const radiance = spec.readsRadiance ? radianceOf(spec.source, lights) : null;
  if (radiance) bindRadiance(sky, radiance.texture);
  writeSkyBindings(sky, {
    camera,
    time: shaderTime(spec.clock),
    brightness: 1,
    fog,
    lights,
    ...(radiance && { borderSize: RADIANCE_OCTMAP.borderSize }),
  });
  const passes = new SkyResolutionPasses(sky);
  passes.draw(displayRenderer, camera, new THREE.Vector2(width, height));
  const scene = new THREE.Scene();
  scene.add(sky.mesh);
  const pixels = framePixels(displayRenderer, scene, camera, {
    width,
    height,
    colorSpace: THREE.SRGBColorSpace,
  });
  passes.dispose();
  radiance?.dispose();
  for (const draw of [sky, sky.half, sky.quarter]) if (draw) disposeDraw(draw);
  return { pixels: Array.from(opaque(pixels)) };
}

function disposeDraw(draw) {
  draw.mesh.geometry.dispose();
  draw.mesh.material.dispose();
}

/** Godot's viewport with no transparent background reads opaque, and the sky writes alpha 0. */
function opaque(pixels) {
  for (let alpha = 3; alpha < pixels.length; alpha += 4) pixels[alpha] = 255;
  return pixels;
}

globalThis.drawSky = drawSky;
