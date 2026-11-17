import * as THREE from 'three';
import {
  PlaybackShaderTime,
  ShaderClock,
  SkyResolutionPasses,
  transpileSky,
  writeSkyBindings,
} from '@textscene/three-godot-shaders';
import { framePixels } from './framePixels.js';
import { displayRenderer, euler, godotCamera, linear } from './godotView.js';

function skyLight(light) {
  const direction = new THREE.Vector3(0, 0, 1).applyEuler(euler(light.rotation)).normalize();
  const color = linear(light.color);
  return { direction, energy: light.energy, color, size: THREE.MathUtils.degToRad(light.size) };
}

/** `TIME` after the frames of `clock`, or after a seek to the time they reach, or 0 for no clock. */
function shaderTime(clock) {
  if (!clock) return 0;
  if (clock.fromSeek) return seekTime(clock);
  const shaderClock = new ShaderClock(clock.rolloverSeconds);
  for (let frame = 0; frame < clock.frames; frame++) shaderClock.advance(1 / clock.fixedFps);
  return shaderClock.time;
}

/** `TIME` as the previewer sets it when the playback controls seek to the time Godot's frames reach. */
function seekTime(clock) {
  const playbackTime = new PlaybackShaderTime(new ShaderClock(clock.rolloverSeconds));
  const paused = { hasPlayer: true, playState: 'paused', seeks: 0, playhead: 0 };
  playbackTime.frame(paused, 0);
  const playhead = clock.frames / clock.fixedFps;
  return playbackTime.frame({ ...paused, seeks: 1, playhead }, 0);
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
  for (const draw of [sky, sky.half, sky.quarter]) draw?.mesh.material.dispose();
  return { pixels: Array.from(opaque(pixels)) };
}

/** Godot's viewport with no transparent background reads opaque, and the sky writes alpha 0. */
function opaque(pixels) {
  for (let alpha = 3; alpha < pixels.length; alpha += 4) pixels[alpha] = 255;
  return pixels;
}

globalThis.drawSky = drawSky;
