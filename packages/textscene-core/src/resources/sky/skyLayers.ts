/**
 * Godot's radiance layers of a sky, which its ambient and its reflections read
 * (`scene_forward_clustered.glsl:1714-1756`), and of each ReflectionProbe's capture, baked on the GPU
 * as Godot bakes them. Layer 0 is the radiance itself. A pass draws the radiance into Godot's octmap,
 * a chain of downsamples shrinks it, and a filter per layer reads that chain around each direction:
 * GGX importance sampling, or the fast filter of a real-time sky or probe. Nothing comes back to the CPU.
 */

import * as THREE from 'three';
import { drawFullScreen, releaseTextures, setUniforms } from '../../r3f/fullScreenPass.js';
import { withMipLevels } from '../../r3f/mipLevels.js';
import { drawOffscreen } from '../../r3f/offscreen/draw.js';
import { perObject } from '../../utils/perObject.js';
import {
  REAL_TIME_ROUGHNESS_LAYERS,
  SKY_ROUGHNESS_LAYERS_DEFAULT,
  skyOctmapLayout,
  type SkyOctmapLayout,
  type SkyRadianceLayout,
} from '../../godot/rendering/environment/skyReflection.js';
import { fastFilter } from './fastFilter.js';
import { importanceSampleFilter } from './importanceSampleFilter.js';
import type { LayerFilter } from './layerFilter.js';
import {
  DOWNSAMPLE_FRAGMENT_SHADER,
  RADIANCE_MIP_FRAGMENT_SHADER,
  RADIANCE_OCTMAP_FRAGMENT_SHADER,
} from './skyLayerShaders.js';
import { skyPass } from './skyPass.js';
import type { SkyBake } from './types.js';
import { GODOT_SAMPLING, type ProjectSampling } from '../../shaders/uniforms/samplerState.js';

/**
 * An octmap array with a mip chain, laid out as `layout`: a sky's radiance layers or the
 * reflection atlas. It holds only the mips the layout names, so a read's lod stops at the last, as
 * Godot's texture ends there.
 */
interface OctmapArray<Layout extends SkyOctmapLayout> {
  readonly layout: Layout;
  readonly target: THREE.WebGLArrayRenderTarget;
}

/**
 * Godot's radiance layers of a sky as its octmap array (`sky.cpp:1545-1576`): an array layer per
 * roughness layer, from layer 0, the radiance, each with a mip chain of its own.
 */
export type SkyLayers = OctmapArray<SkyRadianceLayout>;

/**
 * Godot's reflection atlas (`light_storage.cpp:1487-1590`): a layer of the texture array per probe,
 * each an octmap with a mip per Godot layer.
 */
export type ReflectionAtlas = OctmapArray<SkyOctmapLayout>;

/** Made once per renderer, as each bake would otherwise compile them again. */
const radianceOctmapPassFor = perObject<THREE.WebGLRenderer, THREE.ShaderMaterial>(() =>
  skyPass(RADIANCE_OCTMAP_FRAGMENT_SHADER, ['radiance', 'size', 'borderSize', 'debanding'])
);
const downsamplePassFor = perObject<THREE.WebGLRenderer, THREE.ShaderMaterial>(() =>
  skyPass(DOWNSAMPLE_FRAGMENT_SHADER, ['source', 'size', 'borderSize'])
);
const radianceMipPassFor = perObject<THREE.WebGLRenderer, THREE.ShaderMaterial>(() =>
  skyPass(RADIANCE_MIP_FRAGMENT_SHADER, ['layers', 'mip'])
);

/** Godot's fast filter, or its importance-sampling filter for layers laid out as `layout`. */
function layerFilter(radianceFilter: SkyBake['radianceFilter'], layout: SkyOctmapLayout): LayerFilter {
  return radianceFilter === 'fast' ? fastFilter : importanceSampleFilter(layout);
}

/** The roughness layers of a sky baked with `radianceFilter`: a real-time sky has seven (`sky.cpp:1547-1550`). */
export function roughnessLayersOf(radianceFilter: SkyBake['radianceFilter']): number {
  return radianceFilter === 'fast' ? REAL_TIME_ROUGHNESS_LAYERS : SKY_ROUGHNESS_LAYERS_DEFAULT;
}

/** The array of a sky baked as `bake`. */
function skyLayersLayout({ radianceFilter, radianceSize }: SkyBake): SkyRadianceLayout {
  return skyOctmapLayout(radianceSize, roughnessLayersOf(radianceFilter));
}

/** `depth` layers of `layout`, read with the project's mip filter (`material_storage.cpp:2458`). */
function createOctmapArray<Layout extends SkyOctmapLayout>(
  layout: Layout,
  depth: number,
  sampling: ProjectSampling = GODOT_SAMPLING
): OctmapArray<Layout> {
  const minFilter = sampling.useNearestMipmapFilter
    ? THREE.LinearMipmapNearestFilter
    : THREE.LinearMipmapLinearFilter;
  const options = { ...MIPMAPPED_TARGET_OPTIONS, minFilter };
  const target = new THREE.WebGLArrayRenderTarget(layout.size, layout.size, depth, options);
  return { layout, target: withMipLevels(target, 1 + layout.downsampledSizes.length) };
}

/** Lets go of the textures a bake set on `gl`'s passes, as the passes outlive it. */
function releasePasses(gl: THREE.WebGLRenderer, filter: LayerFilter): void {
  for (const passFor of [radianceOctmapPassFor, downsamplePassFor, filter.passFor])
    releaseTextures(passFor(gl));
}

/** Godot's sky layers for `bake`, which nothing has drawn. The caller frees them with `disposeSkyLayers`. */
export function createSkyLayers(bake: SkyBake, sampling?: ProjectSampling): SkyLayers {
  const layout = skyLayersLayout(bake);
  return createOctmapArray(layout, layout.layerSizes.length, sampling);
}

/** Bakes `layers` with targets it keeps from bake to bake, a layer at a time for an incremental sky. */
export class SkyLayerBaker {
  private readonly chain: RadianceChain;

  constructor(
    private readonly gl: THREE.WebGLRenderer,
    private readonly layers: SkyLayers,
    radianceFilter: SkyBake['radianceFilter']
  ) {
    this.chain = new RadianceChain(gl, layers.layout, radianceFilter);
  }

  /** Draws `drawRadiance` into layer 0, then filters each other layer from it. */
  bakeEveryLayer(drawRadiance: DrawRadiance): void {
    this.bakeFirstLayer(drawRadiance);
    for (let layer = 1; layer < this.layers.layout.layerSizes.length; layer += 1) this.filterLayer(layer);
  }

  /** Draws `drawRadiance` into layer 0, and keeps its chain for `filterLayer`. */
  bakeFirstLayer(drawRadiance: DrawRadiance): void {
    this.chain.draw(drawRadiance);
    this.store(0);
  }

  /** Filters roughness layer `layer` into `layers` from the chain of the last `bakeFirstLayer`. */
  filterLayer(layer: number): void {
    const { octmap } = this.chain;
    this.chain.filterInto(layer, octmap, 0, 0);
    this.store(layer);
  }

  dispose(): void {
    this.chain.dispose();
  }

  /** Copies the chain's octmap into `layer` with its mips. */
  private store(layer: number): void {
    const { gl, layers, chain } = this;
    drawOffscreen(gl, () => {
      if (layer === 0) gl.initRenderTarget(layers.target);
      storeSkyLayer(gl, layers, layer, chain.octmap, chain.scratch);
    });
    releasePasses(gl, chain.filter);
  }
}

/** A radiance octmap and the downsampled chain of it that a filter reads, for one bake after another. */
class RadianceChain {
  readonly scratch = new ScratchOctmaps();
  readonly filter: LayerFilter;
  // Not a scratch octmap: a chain's first mip can be as wide as it, and would then draw into its source.
  readonly octmap: THREE.WebGLRenderTarget;
  private readonly chain: THREE.WebGLRenderTarget;

  constructor(
    private readonly gl: THREE.WebGLRenderer,
    private readonly layout: SkyOctmapLayout,
    radianceFilter: SkyBake['radianceFilter']
  ) {
    this.filter = layerFilter(radianceFilter, layout);
    this.octmap = new THREE.WebGLRenderTarget(layout.size, layout.size, TARGET_OPTIONS);
    try {
      this.chain = chainTarget(this.filter.chainSizes);
    } catch (error) {
      this.octmap.dispose();
      throw error;
    }
  }

  /** Draws `drawRadiance` over the octmap, then shrinks it into the chain. */
  draw(drawRadiance: DrawRadiance): void {
    const { gl, layout, octmap, chain } = this;
    drawOffscreen(gl, () => {
      drawRadiance(octmap, layout);
      gl.initRenderTarget(chain);
      downsample(gl, octmap, this.filter.chainSizes, layout.borderSize, this.scratch, (mip, level) =>
        gl.copyTextureToTexture(mip.texture, chain.texture, null, null, 0, level)
      );
    });
    releasePasses(gl, this.filter);
  }

  /** Draws roughness layer `layer`, filtered from the chain, into `targetLayer` and mip `mip` of `target`. */
  filterInto(layer: number, target: THREE.WebGLRenderTarget, targetLayer: number, mip: number): void {
    const { gl, filter, layout } = this;
    const pass = filter.passFor(gl);
    setUniforms(pass, {
      chain: this.chain.texture,
      borderSize: layout.borderSize,
      layerSize: layout.layerSizes[layer],
      ...filter.layerUniforms(layer),
    });
    drawOffscreen(gl, () => drawFullScreen(gl, pass, target, targetLayer, mip));
    releasePasses(gl, filter);
  }

  dispose(): void {
    this.chain.dispose();
    this.octmap.dispose();
    this.scratch.dispose();
  }
}

/** Copies mip `mip` of layer 0 into `target`, top row first: the last radiance an octmap pass reads. */
export function copyRadianceMip(
  gl: THREE.WebGLRenderer,
  { target: layers }: SkyLayers,
  mip: number,
  target: THREE.WebGLRenderTarget
): void {
  const pass = radianceMipPassFor(gl);
  setUniforms(pass, { layers: layers.texture, mip });
  drawOffscreen(gl, () => drawFullScreen(gl, pass, target));
  releaseTextures(pass);
}

export function disposeSkyLayers(layers: SkyLayers): void {
  layers.target.dispose();
}

/** An atlas of `probeCount` layers laid out as `layout`. The caller owns its target. */
export function createReflectionAtlas(layout: SkyOctmapLayout, probeCount: number): ReflectionAtlas {
  // A texture array needs a layer, so an atlas of no probes holds one nothing reads.
  return createOctmapArray(layout, Math.max(probeCount, 1));
}

/**
 * Draws the capture in `radiance` into layer `index` of `atlas`: the radiance into mip 0, and each
 * filtered layer into its own mip, as Godot writes a probe's layers (`sky.cpp:313-333`). Godot copies
 * a capture into its octmap with no sky shader, so it carries no debanding noise.
 */
export function bakeAtlasLayers(
  gl: THREE.WebGLRenderer,
  radiance: THREE.CubeTexture,
  atlas: ReflectionAtlas,
  index: number,
  radianceFilter: SkyBake['radianceFilter']
): void {
  const { layout, target } = atlas;
  if (index < 0 || index >= target.depth)
    throw new Error(`expected an atlas layer from 0 to ${target.depth - 1}, got ${index}`);
  const chain = new RadianceChain(gl, layout, radianceFilter);
  try {
    chain.draw(cubeRadiance(gl, radiance, 0));
    drawOffscreen(gl, () => {
      gl.initRenderTarget(target);
      gl.copyTextureToTexture(chain.octmap.texture, target.texture, null, new THREE.Vector3(0, 0, index));
    });
    for (let layer = 1; layer < layout.layerSizes.length; layer += 1)
      chain.filterInto(layer, target, index, layer);
  } finally {
    chain.dispose();
  }
}

/** Draws a bake's radiance over `octmap`, laid out as `layout`. */
export type DrawRadiance = (octmap: THREE.WebGLRenderTarget, layout: SkyOctmapLayout) => void;

/**
 * The radiance of the cube `radiance`, as wide as the radiance size, drawn into Godot's octmap, with
 * `debanding` scaling its noise.
 */
export function cubeRadiance(gl: THREE.WebGLRenderer, radiance: THREE.CubeTexture, debanding: number): DrawRadiance {
  return (target, layout) => {
    const pass = radianceOctmapPassFor(gl);
    setUniforms(pass, { radiance, size: layout.size, borderSize: layout.borderSize, debanding });
    drawFullScreen(gl, pass, target);
  };
}

/**
 * Shrinks `source` to each of `sizes` in turn, each mip from the one before
 * (`octmap_downsampler.glsl`), and hands each to `keep` with its index. Each mip draws into a
 * scratch octmap, as a pass cannot read the texture it draws into, so `keep` copies it out.
 */
function downsample(
  gl: THREE.WebGLRenderer,
  source: THREE.WebGLRenderTarget,
  sizes: readonly number[],
  borderSize: number,
  scratch: ScratchOctmaps,
  keep: (mip: THREE.WebGLRenderTarget, index: number) => void
): void {
  const pass = downsamplePassFor(gl);
  let from = source;
  sizes.forEach((size, index) => {
    const mip = scratch.octmap(size);
    setUniforms(pass, { source: from.texture, size, borderSize });
    drawFullScreen(gl, pass, mip);
    keep(mip, index);
    from = mip;
  });
}

/**
 * Copies `mip0` into layer `layer` of `layers`, then shrinks it into each of the layer's other mips
 * (`sky.cpp:481-500`).
 */
function storeSkyLayer(
  gl: THREE.WebGLRenderer,
  { layout, target }: SkyLayers,
  layer: number,
  mip0: THREE.WebGLRenderTarget,
  scratch: ScratchOctmaps
): void {
  const position = new THREE.Vector3(0, 0, layer);
  gl.copyTextureToTexture(mip0.texture, target.texture, null, position, 0, 0);
  downsample(gl, mip0, layout.downsampledSizes, layout.borderSize, scratch, (mip, index) =>
    gl.copyTextureToTexture(mip.texture, target.texture, null, position, 0, index + 1)
  );
}

/**
 * The octmaps a bake downsamples into before it copies them out, one per width, so every layer draws
 * into the same few. Each width of a run differs from the next, so a downsample never reads the octmap
 * it draws into.
 */
class ScratchOctmaps {
  private readonly targets = new Map<number, THREE.WebGLRenderTarget>();

  octmap(size: number): THREE.WebGLRenderTarget {
    let target = this.targets.get(size);
    if (!target) {
      target = new THREE.WebGLRenderTarget(size, size, TARGET_OPTIONS);
      this.targets.set(size, target);
    }
    return target;
  }

  dispose(): void {
    for (const target of this.targets.values()) target.dispose();
    this.targets.clear();
  }
}

/**
 * Half-float targets with no depth. Each filters linearly and clamps to its edge, as Godot's
 * samplers for the sky's octmaps do (`copy_effects.cpp:1155`, `:1366`). An array texture
 * magnifies by its nearest texel unless told otherwise (three r187 `DataArrayTexture.js:47`).
 */
const TARGET_OPTIONS: THREE.RenderTargetOptions = {
  type: THREE.HalfFloatType,
  depthBuffer: false,
  generateMipmaps: false,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
};

const MIPMAPPED_TARGET_OPTIONS: THREE.RenderTargetOptions = {
  ...TARGET_OPTIONS,
  minFilter: THREE.LinearMipmapLinearFilter,
};

/** The chain's octmap, a mip for each of `sizes`, which a filter reads between mips. */
function chainTarget(sizes: readonly number[]): THREE.WebGLRenderTarget {
  const size = sizes[0]!;
  return withMipLevels(new THREE.WebGLRenderTarget(size, size, MIPMAPPED_TARGET_OPTIONS), sizes.length);
}
