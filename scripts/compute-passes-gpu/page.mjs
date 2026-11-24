import * as THREE from 'three';
import { installNodesHandler } from '../../packages/textscene-core/src/shaders/nodesHandler.ts';
import { computePasses } from '../../packages/textscene-core/src/shaders/template/compute/computePasses.ts';
import { computeStage } from '../../packages/textscene-core/src/shaders/template/compute/computeStage.ts';
import { emitComputePass } from '../../packages/textscene-core/src/shaders/template/compute/emitComputePass.ts';
import { DOWNSAMPLE_FRAGMENT_SHADER } from '../../packages/textscene-core/src/resources/sky/skyLayerShaders.ts';
import { skyPass } from '../../packages/textscene-core/src/resources/sky/skyPass.ts';
import { drawFullScreen, setUniforms } from '../../packages/textscene-core/src/r3f/fullScreenPass.ts';

/* global window, document */
// `window` and `document` exist only in the browser that loads this page.

/** The source octmap's side, and the side of the mip the downsampler writes from it. */
const SOURCE_SIZE = 64;
const MIP_SIZE = SOURCE_SIZE / 2;

/** Godot's `1 - 2 * padding` for an octmap with a padding of 2 texels at 64 (`sky.cpp:1553-1559`). */
const BORDER_SIZE = 1 - (2 * 2) / SOURCE_SIZE;

THREE.ColorManagement.enabled = false;
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
installNodesHandler(renderer, 'linear');

/** A source whose channels vary smoothly and apart, so a wrong tap or weight shows in the result. */
function sourceOctmap() {
  const data = new Float32Array(SOURCE_SIZE * SOURCE_SIZE * 4);
  for (let y = 0; y < SOURCE_SIZE; y += 1)
    for (let x = 0; x < SOURCE_SIZE; x += 1) {
      const at = (y * SOURCE_SIZE + x) * 4;
      data[at] = 0.5 + 0.5 * Math.sin(x * 0.37);
      data[at + 1] = 0.5 + 0.5 * Math.cos(y * 0.23);
      data[at + 2] = ((x * 7 + y * 13) % 17) / 17;
      data[at + 3] = 1;
    }
  const texture = new THREE.DataTexture(data, SOURCE_SIZE, SOURCE_SIZE, THREE.RGBAFormat, THREE.FloatType);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function floatTarget(size) {
  return new THREE.WebGLRenderTarget(size, size, { type: THREE.FloatType, depthBuffer: false });
}

function readBack(target) {
  const pixels = new Float32Array(target.width * target.height * 4);
  renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, pixels);
  return Array.from(pixels);
}

function handDownsample(source) {
  const target = floatTarget(MIP_SIZE);
  const pass = skyPass(DOWNSAMPLE_FRAGMENT_SHADER, ['source', 'size', 'borderSize']);
  setUniforms(pass, { source, size: MIP_SIZE, borderSize: BORDER_SIZE });
  drawFullScreen(renderer, pass, target);
  return readBack(target);
}

function loweredDownsample(source) {
  const target = floatTarget(MIP_SIZE);
  const [pass] = computePasses(computeStage('effects/octmap_downsampler.glsl', ''));
  const draw = emitComputePass(pass);
  draw.textures.get('source_octmap').value = source;
  draw.uniforms.get('params.size').value = MIP_SIZE;
  draw.uniforms.get('params.border_size').value = BORDER_SIZE;
  const scene = new THREE.Scene();
  scene.add(draw.mesh);
  renderer.setRenderTarget(target);
  renderer.render(scene, new THREE.Camera());
  renderer.setRenderTarget(null);
  return readBack(target);
}

window.computePassSamples = () => {
  const source = sourceOctmap();
  return { downsampler: { hand: handDownsample(source), lowered: loweredDownsample(source) } };
};
