import * as THREE from 'three';
import { drawFullScreen, releaseTextures, setUniforms } from '../../r3f/fullScreenPass.js';
import { withMipLevels } from '../../r3f/mipLevels.js';
import { drawOffscreen } from '../../r3f/offscreen/draw.js';
import { perObject } from '../../utils/perObject.js';
import {
  DEFAULT_FAST_FILTER_QUALITY,
  type FastFilterQuality,
  type SkyOctmapLayout,
} from '../../godot/rendering/environment/skyReflection.js';
import { FAST_FILTERS, importanceSampleFilter, type FastFilter, type LayerFilter } from './layerFilter.js';
import { drawDownsample, drawFastFilter, drawRoughness, type FilteredImages } from './octmapPasses.js';
import { RADIANCE_MIP_FRAGMENT_SHADER, RADIANCE_OCTMAP_FRAGMENT_SHADER } from './skyLayerShaders.js';
import {
  MIPMAPPED_TARGET_OPTIONS,
  TARGET_OPTIONS,
  type ReflectionAtlas,
  type SkyLayers,
} from './octmapArrays.js';
import { skyPass } from './skyPass.js';
import type { SkyBake } from './types.js';

/** The layers the fast filter draws, 1 to 6: a real-time sky's seven but the radiance (`sky.cpp:1547`). */
const FAST_LAYERS = 6;

/** Made once per renderer, as each bake would otherwise compile them again. */
const radianceOctmapPassFor = perObject<THREE.WebGLRenderer, THREE.ShaderMaterial>(() =>
  skyPass(RADIANCE_OCTMAP_FRAGMENT_SHADER, ['radiance', 'size', 'borderSize'])
);
const radianceMipPassFor = perObject<THREE.WebGLRenderer, THREE.ShaderMaterial>(() =>
  skyPass(RADIANCE_MIP_FRAGMENT_SHADER, ['layers', 'mip'])
);

/** `fast` for a real-time bake, or Godot's importance-sampling filter for `layout`. */
function layerFilter(
  fast: LayerFilter,
  radianceFilter: SkyBake['radianceFilter'],
  layout: SkyOctmapLayout
): LayerFilter {
  return radianceFilter === 'fast' ? fast : importanceSampleFilter(layout);
}

/** Lets go of the textures a bake set on `gl`'s radiance pass, as the pass outlives it. */
function releasePasses(gl: THREE.WebGLRenderer): void {
  releaseTextures(radianceOctmapPassFor(gl));
}

/** Bakes `layers` with targets it keeps from bake to bake, a layer at a time for an incremental sky. */
export class SkyLayerBaker {
  private readonly chain: RadianceChain;

  constructor(
    private readonly gl: THREE.WebGLRenderer,
    private readonly layers: SkyLayers,
    radianceFilter: SkyBake['radianceFilter'],
    fastFilterQuality: FastFilterQuality = DEFAULT_FAST_FILTER_QUALITY
  ) {
    this.chain = new RadianceChain(
      gl,
      layers.layout,
      layerFilter(FAST_FILTERS[fastFilterQuality].intoLayers, radianceFilter, layers.layout)
    );
  }

  /** Draws `drawRadiance` into layer 0, then filters each other layer from it. */
  bakeEveryLayer(drawRadiance: DrawRadiance): void {
    this.bakeFirstLayer(drawRadiance);
    const { filter, octmap } = this.chain;
    if (filter.kind === 'importance-sample') {
      for (let layer = 1; layer < this.layers.layout.layerSizes.length; layer += 1) this.filterLayer(layer);
      return;
    }
    const filtered = this.chain.fastFiltered(filter);
    for (let layer = 1; layer <= FAST_LAYERS; layer += 1) {
      drawOffscreen(this.gl, () => filtered.copyInto(layer - 1, octmap, 0, 0));
      this.store(layer);
    }
  }

  /** Draws `drawRadiance` into layer 0, and keeps its chain for `filterLayer`. */
  bakeFirstLayer(drawRadiance: DrawRadiance): void {
    this.chain.draw(drawRadiance);
    this.store(0);
  }

  /** Filters roughness layer `layer` into `layers` from the chain of the last `bakeFirstLayer`. */
  filterLayer(layer: number): void {
    const { octmap } = this.chain;
    this.chain.importanceSampleInto(layer, octmap, 0, 0);
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
  }
}

/** A radiance octmap and the downsampled chain of it that a filter reads, for one bake after another. */
class RadianceChain {
  readonly scratch = new ScratchOctmaps();
  // Not a scratch octmap: a chain's first mip can be as wide as it, and would then draw into its source.
  readonly octmap: THREE.WebGLRenderTarget;
  private readonly chain: THREE.WebGLRenderTarget;

  constructor(
    private readonly gl: THREE.WebGLRenderer,
    private readonly layout: SkyOctmapLayout,
    readonly filter: LayerFilter
  ) {
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
    releasePasses(gl);
  }

  /** Draws layer `layer`, importance sampled from the chain, into `targetLayer` and `mip` of `target`. */
  importanceSampleInto(
    layer: number,
    target: THREE.WebGLRenderTarget,
    targetLayer: number,
    mip: number
  ): void {
    const { gl, filter, layout } = this;
    if (filter.kind !== 'importance-sample')
      throw new Error(`expected an importance-sampled bake to filter layer ${layer} alone, got a fast one`);
    const roughness = {
      chain: this.chain.texture,
      chainSize: filter.chainSizes[0]!,
      roughness: layer / (layout.layerSizes.length - 1),
      size: layout.layerSizes[layer]!,
      borderSize: layout.borderSize,
    };
    drawOffscreen(gl, () => drawRoughness(gl, roughness, target, targetLayer, mip));
  }

  /** Draws `filter` of layers 1 to 6 in one go (`sky.cpp:409-419`), for the caller to copy out. */
  fastFiltered(filter: FastFilter): FilteredImages {
    const { gl, layout } = this;
    const sizes = layout.layerSizes.slice(1, FAST_LAYERS + 1);
    let filtered: FilteredImages | undefined;
    drawOffscreen(gl, () => {
      filtered = drawFastFilter(
        gl,
        this.chain.texture,
        layout.borderSize,
        filter.quality,
        sizes,
        filter.isTextureArray
      );
    });
    return filtered!;
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
  radianceFilter: SkyBake['radianceFilter'],
  fastFilterQuality: FastFilterQuality = DEFAULT_FAST_FILTER_QUALITY
): void {
  const { layout, target } = atlas;
  if (index < 0 || index >= target.depth)
    throw new Error(`expected an atlas layer from 0 to ${target.depth - 1}, got ${index}`);
  const chain = new RadianceChain(
    gl,
    layout,
    layerFilter(FAST_FILTERS[fastFilterQuality].intoMips, radianceFilter, layout)
  );
  try {
    chain.draw(cubeRadiance(gl, radiance));
    drawOffscreen(gl, () => {
      gl.initRenderTarget(target);
      gl.copyTextureToTexture(chain.octmap.texture, target.texture, null, new THREE.Vector3(0, 0, index));
    });
    const { filter } = chain;
    if (filter.kind === 'fast') {
      const filtered = chain.fastFiltered(filter);
      drawOffscreen(gl, () => {
        for (let layer = 1; layer <= FAST_LAYERS; layer += 1)
          filtered.copyInto(layer - 1, target, index, layer);
      });
    } else
      for (let layer = 1; layer < layout.layerSizes.length; layer += 1)
        chain.importanceSampleInto(layer, target, index, layer);
  } finally {
    chain.dispose();
  }
}

/** Draws a bake's radiance over `octmap`, laid out as `layout`. */
export type DrawRadiance = (octmap: THREE.WebGLRenderTarget, layout: SkyOctmapLayout) => void;

/** The cube `radiance`, as wide as the radiance size, drawn into Godot's octmap. */
export function cubeRadiance(gl: THREE.WebGLRenderer, radiance: THREE.CubeTexture): DrawRadiance {
  return (target, layout) => {
    const pass = radianceOctmapPassFor(gl);
    setUniforms(pass, { radiance, size: layout.size, borderSize: layout.borderSize });
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
  let from = source;
  sizes.forEach((size, index) => {
    const mip = scratch.octmap(size);
    drawDownsample(gl, from.texture, mip, size, borderSize);
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

/** The chain's octmap, a mip for each of `sizes`, which a filter reads between mips. */
function chainTarget(sizes: readonly number[]): THREE.WebGLRenderTarget {
  const size = sizes[0]!;
  return withMipLevels(new THREE.WebGLRenderTarget(size, size, MIPMAPPED_TARGET_OPTIONS), sizes.length);
}
