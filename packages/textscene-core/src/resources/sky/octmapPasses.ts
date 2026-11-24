import * as THREE from 'three';
import { FAST_FILTER_COEFFICIENTS } from '../../godot/rendering/environment/skyFastFilterCoefficients.js';
import { FAST_FILTER_HIGH_QUALITY_COEFFICIENTS } from '../../godot/rendering/environment/skyFastFilterHighQualityCoefficients.js';
import {
  SKY_GGX_SAMPLES_DEFAULT,
  type FastFilterQuality,
} from '../../godot/rendering/environment/skyReflection.js';
import { computePasses } from '../../shaders/template/compute/computePasses.js';
import { computeStage } from '../../shaders/template/compute/computeStage.js';
import { emitComputePass, type ComputeDraw } from '../../shaders/template/compute/emitComputePass.js';
import { hasNodesHandler } from '../../shaders/pipeline/nodeObject.js';
import { perObject } from '../../utils/perObject.js';

/** A value a lowered pass reads by its template name: a uniform's, or a texture. */
type PassValues = Readonly<Record<string, unknown>>;

/** Draws `draw` into `layer` and `mip` of `target`, its inputs set by name from `values`, without a clear. */
function drawCompute(
  gl: THREE.WebGLRenderer,
  draw: ComputeDraw,
  values: PassValues,
  target: THREE.WebGLRenderTarget,
  layer = 0,
  mip = 0
): void {
  if (!hasNodesHandler(gl))
    throw new Error('expected a nodes handler on the renderer before a lowered pass draws');
  for (const [name, value] of Object.entries(values)) {
    const binding = draw.textures.get(name) ?? draw.uniforms.get(name);
    if (!binding || !('value' in binding))
      throw new Error(`expected a uniform or texture of the lowered pass, got ${name}`);
    binding.value = value;
  }
  withStoredOutput(gl, () => {
    gl.setRenderTarget(target, layer, mip);
    gl.render(draw.mesh, CAMERA);
  });
}

/** Runs `draw` with no tone mapping and a linear output, as a node material's output takes both. */
function withStoredOutput(gl: THREE.WebGLRenderer, draw: () => void): void {
  const { toneMapping, outputColorSpace } = gl;
  gl.toneMapping = THREE.NoToneMapping;
  gl.outputColorSpace = THREE.LinearSRGBColorSpace;
  try {
    draw();
  } finally {
    gl.toneMapping = toneMapping;
    gl.outputColorSpace = outputColorSpace;
  }
}

/** Lowered passes read no matrix, so any camera draws them. */
const CAMERA = new THREE.Camera();

/** `params.border_size`: the padding in UV, then 1 minus twice it (`oct_inc.glsl:35`). */
const borderSizes = (borderSize: number) => new THREE.Vector2((1 - borderSize) / 2, borderSize);

/** One draw of a stage's only pass per renderer, as each draw holds the programs the renderer compiles. */
const onlyPassFor = (file: string, defines = '') =>
  perObject<THREE.WebGLRenderer, ComputeDraw>(() => {
    const [pass, ...others] = computePasses(computeStage(file, defines));
    if (!pass || others.length > 0)
      throw new Error(`expected one pass of ${file}, found ${others.length + 1}`);
    return emitComputePass(pass);
  });

const downsamplerFor = onlyPassFor('effects/octmap_downsampler.glsl');

/** Draws the downsample of `source` into `target`, `size` wide (`copy_effects.cpp:1145-1160`). */
export function drawDownsample(
  gl: THREE.WebGLRenderer,
  source: THREE.Texture,
  target: THREE.WebGLRenderTarget,
  size: number,
  borderSize: number
): void {
  const values = { source_octmap: source, 'params.size': size, 'params.border_size': borderSize };
  drawCompute(gl, downsamplerFor(gl), values, target);
}

/** The fill of GGX samples and the pass that reads them, one each per renderer. */
const roughnessFor = perObject<THREE.WebGLRenderer, readonly [ComputeDraw, ComputeDraw]>(() => {
  const [fill, layer] = computePasses(computeStage('effects/octmap_roughness.glsl', ''));
  return [emitComputePass(fill!), emitComputePass(layer!)];
});

/** The target the GGX samples fill, one texel an entry of `samples[256]`, per renderer. */
const samplesTargetFor = perObject<THREE.WebGLRenderer, THREE.WebGLRenderTarget>(
  () => new THREE.WebGLRenderTarget(GGX_SAMPLE_ENTRIES, 1, { type: THREE.FloatType, depthBuffer: false })
);

/** `octmap_roughness.glsl:11`: `samples[GROUP_SIZE * GROUP_SIZE * 4]`. */
const GGX_SAMPLE_ENTRIES = 256;

/** What `copy_effects.cpp:1345-1363` reads to filter one roughness layer. */
export interface RoughnessLayer {
  readonly chain: THREE.Texture;
  readonly chainSize: number;
  /** The layer's index over its last, 0 to 1, which Godot squares (`copy_effects.cpp:1355`). */
  readonly roughness: number;
  readonly size: number;
  readonly borderSize: number;
}

/** The push constants `copy_effects.cpp:1355-1362` gives the roughness stage for `layer`. */
export function roughnessValues({
  chain,
  chainSize,
  roughness,
  size,
  borderSize,
}: RoughnessLayer): PassValues {
  return {
    source_oct: chain,
    'params.sample_count': Math.min(SKY_GGX_SAMPLES_DEFAULT, MOST_GGX_SAMPLES),
    'params.roughness': roughness * roughness,
    'params.source_size': chainSize,
    'params.dest_size': size,
    'params.border_size': borderSizes(borderSize),
    'params.use_direct_write': roughness === 0,
  };
}

/** `copy_effects.cpp:1356`: Godot caps the sample count at 64. */
const MOST_GGX_SAMPLES = 64;

/** Draws a roughness layer into `layer` and `mip` of `target`: its samples, then the layer from them. */
export function drawRoughness(
  gl: THREE.WebGLRenderer,
  roughnessLayer: RoughnessLayer,
  target: THREE.WebGLRenderTarget,
  layer: number,
  mip: number
): void {
  const [fill, filter] = roughnessFor(gl);
  const samples = samplesTargetFor(gl);
  const values = roughnessValues(roughnessLayer);
  drawCompute(gl, fill, values, samples);
  drawCompute(gl, filter, { ...values, compute_shared_samples: samples.texture }, target, layer, mip);
}

const TEXTURE_ARRAY = '#define USE_TEXTURE_ARRAY\n';
const HIGH_QUALITY = '#define USE_HIGH_QUALITY\n';

/** The fast filter's scatter passes of each table and path, which `copy_effects.cpp:196-204` picks. */
function fastFilterPassesFor(quality: FastFilterQuality, isTextureArray: boolean) {
  const defines = (quality === 'high' ? HIGH_QUALITY : '') + (isTextureArray ? TEXTURE_ARRAY : '');
  return perObject<THREE.WebGLRenderer, readonly ComputeDraw[]>(() =>
    computePasses(computeStage('effects/octmap_filter.glsl', defines)).map((pass) => {
      const draw = emitComputePass(pass);
      draw.buffers.get('data')!.write(coefficientWords(quality));
      return draw;
    })
  );
}

const FAST_FILTER_PASSES = {
  low: { layers: fastFilterPassesFor('low', true), mips: fastFilterPassesFor('low', false) },
  high: { layers: fastFilterPassesFor('high', true), mips: fastFilterPassesFor('high', false) },
} as const;

/** Godot's table as the std430 words of `coeffs`: 7 levels, 6 of them read (`octmap_filter.glsl:56-64`). */
export function coefficientWords(quality: FastFilterQuality): Uint32Array {
  const levelFloats = quality === 'high' ? 5 * 3 * 24 * 4 : 5 * 6 * 4;
  const floats = new Float32Array(7 * levelFloats);
  if (quality === 'high') floats.set(FAST_FILTER_HIGH_QUALITY_COEFFICIENTS);
  else
    FAST_FILTER_COEFFICIENTS.forEach((level, index) =>
      floats.set(
        [level.frameX, level.frameY, level.frameZ, level.lod, level.weight].flatMap((part) => part.flat()),
        index * levelFloats
      )
    );
  return new Uint32Array(floats.buffer);
}

/** The six images of a fast filter draw, `dest_octmap0` to `5`, each copied out where it belongs. */
export interface FilteredImages {
  /** Copies image `index` into `layer` and `mip` of `target`, at its origin. */
  copyInto(index: number, target: THREE.WebGLRenderTarget, layer: number, mip: number): void;
}

/** Draws Godot's fast filter dispatch into an atlas of six images `sizes` wide (`copy_effects.cpp:1240`). */
export function drawFastFilter(
  gl: THREE.WebGLRenderer,
  chain: THREE.Texture,
  borderSize: number,
  quality: FastFilterQuality,
  sizes: readonly number[],
  isTextureArray: boolean
): FilteredImages {
  if (sizes.length !== FILTER_IMAGES)
    throw new Error(`expected ${FILTER_IMAGES} images for the fast filter, got ${sizes.length}`);
  const passes = FAST_FILTER_PASSES[quality][isTextureArray ? 'layers' : 'mips'](gl);
  const atlas = atlasFor(gl, sizes);
  const values: Record<string, unknown> = {
    source_octmap: chain,
    'params.border_size': borderSizes(borderSize),
    compute_atlas_size: new THREE.Vector2(atlas.target.width, atlas.target.height),
  };
  sizes.forEach((size, index) => {
    values[`compute_origin_${index}`] = atlas.origins[index];
    values[`compute_size_${index}`] = new THREE.Vector2(size, size);
  });
  gl.setRenderTarget(atlas.target);
  gl.clear();
  for (const draw of passes) {
    draw.dispatch!([filterInvocations(isTextureArray), 1, 1]);
    drawCompute(gl, draw, values, atlas.target);
  }
  return {
    copyInto(index, target, layer, mip) {
      const origin = atlas.origins[index]!;
      const region = new THREE.Box2(origin.clone(), origin.clone().addScalar(sizes[index]!));
      gl.copyTextureToTexture(
        atlas.target.texture,
        target.texture,
        region,
        new THREE.Vector3(0, 0, layer),
        0,
        mip
      );
    },
  };
}

/** `dest_octmap0` to `dest_octmap5` (`octmap_filter.glsl:34-39`). */
const FILTER_IMAGES = 6;

/** Each image's width in invocations, halved for each mip without arrays (`octmap_filter.glsl:53`). */
const BASE_RESOLUTION = 320;

/** The invocations that store: Godot dispatches this many groups (`copy_effects.cpp:1222`). */
export function filterInvocations(isTextureArray: boolean): number {
  const sizes = Array.from({ length: 6 }, (_, mip) =>
    isTextureArray ? BASE_RESOLUTION : BASE_RESOLUTION >> mip
  );
  return sizes.reduce((sum, size) => sum + size * size, 0);
}

export interface Atlas {
  readonly target: THREE.WebGLRenderTarget;
  readonly origins: readonly THREE.Vector2[];
}

/** Images in a row while they fit WebGL 2's least texture size, 2048, and then in the next row. */
const ATLAS_SIDE = 2048;

/** A renderer's atlas and the image sizes it was laid out for, written only by `atlasFor`. */
const heldAtlasOf = perObject<THREE.WebGLRenderer, { sizes: string; atlas: Atlas | null }>(() => ({
  sizes: '',
  atlas: null,
}));

/** The atlas images `sizes` wide fit in, side by side, laid out again when the sizes change. */
function atlasFor(gl: THREE.WebGLRenderer, sizes: readonly number[]): Atlas {
  const held = heldAtlasOf(gl);
  const key = sizes.join(',');
  if (held.atlas && held.sizes === key) return held.atlas;
  held.atlas?.target.dispose();
  held.atlas = laidOut(sizes);
  held.sizes = key;
  return held.atlas;
}

/** Images `sizes` wide side by side, in rows of at most `ATLAS_SIDE`. */
export function laidOut(sizes: readonly number[]): Atlas {
  const origins: THREE.Vector2[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let width = 0;
  for (const size of sizes) {
    if (x + size > ATLAS_SIDE) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    origins.push(new THREE.Vector2(x, y));
    x += size;
    width = Math.max(width, x);
    rowHeight = Math.max(rowHeight, size);
  }
  const target = new THREE.WebGLRenderTarget(width, y + rowHeight, {
    type: THREE.HalfFloatType,
    depthBuffer: false,
  });
  return { target, origins };
}
