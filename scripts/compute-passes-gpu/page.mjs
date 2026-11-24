import * as THREE from 'three';
import { installNodesHandler } from '../../packages/textscene-core/src/shaders/nodesHandler.ts';
import { computePasses } from '../../packages/textscene-core/src/shaders/template/compute/computePasses.ts';
import { computeStage } from '../../packages/textscene-core/src/shaders/template/compute/computeStage.ts';
import { emitComputePass } from '../../packages/textscene-core/src/shaders/template/compute/emitComputePass.ts';
import { DOWNSAMPLE_FRAGMENT_SHADER } from '../../packages/textscene-core/src/resources/sky/skyLayerShaders.ts';
import { importanceSampleFilter } from '../../packages/textscene-core/src/resources/sky/importanceSampleFilter.ts';
import {
  layerSamples,
  SKY_ROUGHNESS_LAYERS_DEFAULT,
  skyOctmapLayout,
} from '../../packages/textscene-core/src/godot/rendering/environment/skyReflection.ts';
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
function sourceOctmap(isMipmapped = false) {
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
  texture.minFilter = isMipmapped ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = isMipmapped;
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

/** Draws `pass` of a lowered stage into `target`, its uniforms and textures set from `values` by name. */
function drawLowered(pass, target, values) {
  const draw = emitComputePass(pass);
  for (const [name, value] of Object.entries(values)) {
    const binding = draw.textures.get(name) ?? draw.uniforms.get(name);
    if (!binding) throw new Error(`expected a uniform or texture of the pass, got ${name}`);
    binding.value = value;
  }
  const scene = new THREE.Scene();
  scene.add(draw.mesh);
  renderer.setRenderTarget(target);
  renderer.render(scene, new THREE.Camera());
  renderer.setRenderTarget(null);
}

function loweredDownsample(source) {
  const target = floatTarget(MIP_SIZE);
  const [pass] = computePasses(computeStage('effects/octmap_downsampler.glsl', ''));
  drawLowered(pass, target, {
    source_octmap: source,
    'params.size': MIP_SIZE,
    'params.border_size': BORDER_SIZE,
  });
  return readBack(target);
}

/** A rough layer of a 64 radiance, which reads several mips of the chain. */
const ROUGH_LAYER = 3;
const LAYOUT = skyOctmapLayout(SOURCE_SIZE, SKY_ROUGHNESS_LAYERS_DEFAULT);
const LAYER_SIZE = LAYOUT.layerSizes[ROUGH_LAYER];

/** The hand pass over `samples`, each a direction and its mip, the entries below the horizon left out. */
function handRoughness(chain, samples) {
  const target = floatTarget(LAYER_SIZE);
  const pass = importanceSampleFilter(LAYOUT).passFor(renderer);
  const lit = aboveHorizon(samples);
  setUniforms(pass, {
    chain,
    borderSize: LAYOUT.borderSize,
    layerSize: LAYER_SIZE,
    samples: Float32Array.from(lit),
    sampleCount: lit.length / 4,
  });
  drawFullScreen(renderer, pass, target);
  return readBack(target);
}

/** The entries of a sample read-back whose direction is above the horizon, which the hand pass takes. */
function aboveHorizon(samples) {
  const entries = Array.from({ length: samples.length / 4 }, (_, i) => samples.slice(i * 4, i * 4 + 4));
  return entries.filter(([, , z]) => z > 0).flat();
}

/** `copy_effects.cpp:1354-1363` for a layer `sky.cpp:473` filters. */
function roughnessParams() {
  const roughness = ROUGH_LAYER / (LAYOUT.layerSizes.length - 1);
  const padding = (1 - LAYOUT.borderSize) / 2;
  return {
    'params.sample_count': 32,
    'params.roughness': roughness * roughness,
    'params.source_size': SOURCE_SIZE,
    'params.dest_size': LAYER_SIZE,
    'params.border_size': new THREE.Vector2(padding, 1 - padding * 2),
    'params.use_direct_write': false,
  };
}

/** The lowered stage's two passes: its shared samples, then the layer it filters with them. */
function loweredRoughness(chain) {
  const params = { ...roughnessParams(), source_oct: chain };
  const [fill, layer] = computePasses(computeStage('effects/octmap_roughness.glsl', ''));
  const samples = new THREE.WebGLRenderTarget(fill.target.array.length, 1, {
    type: THREE.FloatType,
    depthBuffer: false,
  });
  drawLowered(fill, samples, params);
  const target = floatTarget(LAYER_SIZE);
  drawLowered(layer, target, { ...params, compute_shared_samples: samples.texture });
  return { samples: readBack(samples), layer: readBack(target) };
}

/** The samples the CPU works out for the bake, in the order the lowered fill writes them. */
const cpuSamples = () =>
  layerSamples(LAYOUT, ROUGH_LAYER).flatMap(({ direction, lod }) => [...direction, lod]);

window.computePassSamples = () => {
  const source = sourceOctmap();
  const chain = sourceOctmap(true);
  const rough = loweredRoughness(chain);
  return {
    downsampler: { hand: handDownsample(source), lowered: loweredDownsample(source) },
    roughnessSamples: { hand: cpuSamples(), lowered: aboveHorizon(rough.samples) },
    roughness: { hand: handRoughness(chain, rough.samples), lowered: rough.layer },
  };
};
