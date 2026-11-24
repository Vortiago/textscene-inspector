import * as THREE from 'three';
import { installNodesHandler } from '../../packages/textscene-core/src/shaders/nodesHandler.ts';
import { computePasses } from '../../packages/textscene-core/src/shaders/template/compute/computePasses.ts';
import { computeStage } from '../../packages/textscene-core/src/shaders/template/compute/computeStage.ts';
import { emitComputePass } from '../../packages/textscene-core/src/shaders/template/compute/emitComputePass.ts';
import { DOWNSAMPLE_FRAGMENT_SHADER } from '../../packages/textscene-core/src/resources/sky/skyLayerShaders.ts';
import { importanceSampleFilter } from '../../packages/textscene-core/src/resources/sky/importanceSampleFilter.ts';
import { FAST_FILTERS } from '../../packages/textscene-core/src/resources/sky/fastFilter.ts';
import { FAST_FILTER_COEFFICIENTS } from '../../packages/textscene-core/src/godot/rendering/environment/skyFastFilterCoefficients.ts';
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
const drawLowered = (pass, target, values) => drawInto(emitComputePass(pass), target, values);

function drawInto(draw, target, values) {
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

/** `octmap_filter.glsl:53`: each image of the filter is a mip of a 320 octmap, without texture arrays. */
const FILTER_SIZES = [320, 160, 80, 40, 20, 10];

/** A mip the filter writes, which reads the chain at a level above its own. */
const FILTER_MIP = 1;

function handFilter(chain) {
  const target = floatTarget(FILTER_SIZES[FILTER_MIP]);
  const filter = FAST_FILTERS.low.intoMips;
  const pass = filter.passFor(renderer);
  setUniforms(pass, {
    chain,
    borderSize: BORDER_SIZE,
    layerSize: FILTER_SIZES[FILTER_MIP],
    ...filter.layerUniforms(FILTER_MIP + 1),
  });
  drawFullScreen(renderer, pass, target);
  return readBack(target);
}

/** Godot's `vec4[7][5][6] coeffs` in std430: level 6 is never read, as the filter clamps at 5. */
function coefficientWords() {
  const parts = ['frameX', 'frameY', 'frameZ', 'lod', 'weight'];
  const floats = new Float32Array(7 * 5 * 6 * 4);
  FAST_FILTER_COEFFICIENTS.forEach((level, index) =>
    floats.set(
      parts.flatMap((part) => level[part].flat()),
      index * 5 * 6 * 4
    )
  );
  return new Uint32Array(floats.buffer);
}

/** The lowered filter's one scatter into an atlas of its six images, stacked from row 0. */
function loweredFilter(chain) {
  const [pass] = computePasses(computeStage('effects/octmap_filter.glsl', ''));
  const origins = FILTER_SIZES.map((_, index) =>
    FILTER_SIZES.slice(0, index).reduce((sum, size) => sum + size, 0)
  );
  const atlas = new THREE.WebGLRenderTarget(FILTER_SIZES[0], origins.at(-1) + FILTER_SIZES.at(-1), {
    type: THREE.FloatType,
    depthBuffer: false,
  });
  const padding = (1 - BORDER_SIZE) / 2;
  const values = {
    source_octmap: chain,
    'params.border_size': new THREE.Vector2(padding, 1 - padding * 2),
    compute_atlas_size: new THREE.Vector2(atlas.width, atlas.height),
  };
  FILTER_SIZES.forEach((size, index) => {
    values[`compute_origin_${index}`] = new THREE.Vector2(0, origins[index]);
    values[`compute_size_${index}`] = new THREE.Vector2(size, size);
  });
  const draw = emitComputePass(pass);
  draw.buffers.get('data').write(coefficientWords());
  const invocations = FILTER_SIZES.reduce((sum, size) => sum + size * size, 0);
  draw.dispatch([invocations, 1, 1]);
  drawInto(draw, atlas, values);
  const size = FILTER_SIZES[FILTER_MIP];
  const pixels = new Float32Array(size * size * 4);
  renderer.readRenderTargetPixels(atlas, 0, origins[FILTER_MIP], size, size, pixels);
  return Array.from(pixels);
}

window.computePassSamples = () => {
  const source = sourceOctmap();
  const chain = sourceOctmap(true);
  const rough = loweredRoughness(chain);
  return {
    downsampler: { hand: handDownsample(source), lowered: loweredDownsample(source) },
    roughnessSamples: { hand: cpuSamples(), lowered: aboveHorizon(rough.samples) },
    roughness: { hand: handRoughness(chain, rough.samples), lowered: rough.layer },
    filter: { hand: handFilter(chain), lowered: loweredFilter(chain) },
  };
};
