/**
 * Godot's radiance layers of a sky, which its ambient and its reflections read
 * (`scene_forward_clustered.glsl:1714-1756`), and of each ReflectionProbe's capture, baked on the GPU
 * as Godot bakes them. Layer 0 is the radiance itself. A pass draws the radiance into Godot's octmap,
 * a chain of downsamples shrinks it, and a filter per layer reads that chain around each direction:
 * GGX importance sampling, or the fast filter of a real-time sky or probe. Nothing comes back to the CPU.
 */

import * as THREE from 'three';
import { drawFullScreen } from '../../r3f/fullScreenPass.js';
import { drawOffscreen } from '../../r3f/offscreen.js';
import { perRenderer } from '../../r3f/perRenderer.js';
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
import { DOWNSAMPLE_FRAGMENT_SHADER, RADIANCE_OCTMAP_FRAGMENT_SHADER } from './skyLayerShaders.js';
import { releaseTextures, setUniforms, skyPass } from './skyPass.js';
import type { SkyBake } from './types.js';

/**
 * An octmap array with a mip chain, laid out as `layout`: a sky's radiance layers or the
 * reflection atlas. A read clamps its lod to the mips the layout names, as Godot's texture ends there.
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
const radianceOctmapPassFor = perRenderer(() =>
  skyPass(RADIANCE_OCTMAP_FRAGMENT_SHADER, ['radiance', 'size', 'borderSize', 'debanding'])
);
const downsamplePassFor = perRenderer(() =>
  skyPass(DOWNSAMPLE_FRAGMENT_SHADER, ['source', 'size', 'borderSize'])
);

/** Godot's fast filter, or its importance-sampling filter for layers laid out as `layout`. */
function layerFilter(radianceFilter: SkyBake['radianceFilter'], layout: SkyOctmapLayout): LayerFilter {
  return radianceFilter === 'fast' ? fastFilter : importanceSampleFilter(layout);
}

/** The array of a sky baked as `bake`: a real-time sky has seven layers (`sky.cpp:1547-1550`). */
function skyLayersLayout({ radianceFilter, radianceSize }: SkyBake): SkyRadianceLayout {
  const layers = radianceFilter === 'fast' ? REAL_TIME_ROUGHNESS_LAYERS : SKY_ROUGHNESS_LAYERS_DEFAULT;
  return skyOctmapLayout(radianceSize, layers);
}

/** An array of `depth` layers laid out as `layout`. The caller owns its target. */
function createOctmapArray<Layout extends SkyOctmapLayout>(
  layout: Layout,
  depth: number
): OctmapArray<Layout> {
  const target = new THREE.WebGLArrayRenderTarget(layout.size, layout.size, depth, MIPMAPPED_TARGET_OPTIONS);
  return { layout, target: withMips(target) };
}

/** Lets go of the textures a bake set on `gl`'s passes, as the passes outlive it. */
function releasePasses(gl: THREE.WebGLRenderer, filter: LayerFilter): void {
  for (const passFor of [radianceOctmapPassFor, downsamplePassFor, filter.passFor])
    releaseTextures(passFor(gl));
}

/**
 * Godot's baked layers of the sky in `radiance`, a cube as wide as the bake's radiance size. The
 * cube stands for Godot's radiance octmap of the same size, which is twice as wide to match a cube's
 * texel density (`sky.cpp:1554-1557`). Each layer's mips shrink its mip 0 as Godot's
 * `update_reflection_mipmaps` does (`sky.cpp:481-500`). `debanding` scales the debanding noise in
 * the radiance, 0 for a sky without it. The caller owns the array, and frees it with
 * `disposeSkyLayers`.
 */
export function bakeSkyLayers(
  gl: THREE.WebGLRenderer,
  radiance: THREE.CubeTexture,
  bake: SkyBake,
  debanding: number
): SkyLayers {
  const layout = skyLayersLayout(bake);
  const filter = layerFilter(bake.radianceFilter, layout);
  const layers = createOctmapArray(layout, layout.layerSizes.length);
  try {
    bakeFromChain(gl, { radiance, debanding }, layout, filter, ({ octmap, scratch }) => {
      gl.initRenderTarget(layers.target);
      storeSkyLayer(gl, layers, 0, octmap, scratch);
      for (let layer = 1; layer < layout.layerSizes.length; layer += 1) {
        drawFilteredLayer(gl, filter, layer, layout, octmap, 0, 0);
        storeSkyLayer(gl, layers, layer, octmap, scratch);
      }
    });
    return layers;
  } catch (error) {
    disposeSkyLayers(layers);
    throw error;
  }
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
  const filter = layerFilter(radianceFilter, layout);
  bakeFromChain(gl, { radiance, debanding: 0 }, layout, filter, ({ octmap }) => {
    gl.initRenderTarget(target);
    gl.copyTextureToTexture(octmap.texture, target.texture, null, new THREE.Vector3(0, 0, index));
    for (let layer = 1; layer < layout.layerSizes.length; layer += 1)
      drawFilteredLayer(gl, filter, layer, layout, target, index, layer);
  });
}

/** The radiance a bake reads, and the scale of the debanding noise its octmap adds. */
interface RadianceSource {
  radiance: THREE.CubeTexture;
  debanding: number;
}

/**
 * What a bake draws its layers with: the radiance's octmap, which a layer may draw over once the
 * chain is built, and the scratch octmaps of the bake.
 */
interface ChainBake {
  octmap: THREE.WebGLRenderTarget;
  scratch: ScratchOctmaps;
}

/**
 * The bake both of Godot's layer sets share: the radiance of `source` drawn into its octmap as
 * `layout` lays it out, shrunk into the chain `filter` reads, then `drawLayers`. It leaves the
 * renderer as it found it.
 */
function bakeFromChain(
  gl: THREE.WebGLRenderer,
  source: RadianceSource,
  layout: SkyOctmapLayout,
  filter: LayerFilter,
  drawLayers: (bake: ChainBake) => void
): void {
  const scratch = new ScratchOctmaps();
  // Not a scratch octmap: a chain's first mip can be as wide as the radiance's octmap, as the fast
  // filter's 160 is at a radiance size of 64, and a downsample would then draw into its own source.
  const octmap = new THREE.WebGLRenderTarget(layout.size, layout.size, TARGET_OPTIONS);
  try {
    drawOffscreen(gl, () => {
      drawRadianceOctmap(gl, source, layout, octmap);
      const chain = downsampleChain(gl, octmap, layout.borderSize, filter.chainSizes, scratch);
      try {
        setUniforms(filter.passFor(gl), {
          chain: chain.texture,
          lastMip: filter.chainSizes.length - 1,
          borderSize: layout.borderSize,
        });
        drawLayers({ octmap, scratch });
      } finally {
        chain.dispose();
      }
    });
  } finally {
    octmap.dispose();
    scratch.dispose();
    releasePasses(gl, filter);
  }
}

/** `octmap` shrunk to each mip of `chainSizes`, into the chain a filter reads. */
function downsampleChain(
  gl: THREE.WebGLRenderer,
  octmap: THREE.WebGLRenderTarget,
  borderSize: number,
  chainSizes: readonly number[],
  scratch: ScratchOctmaps
): THREE.WebGLRenderTarget {
  const chain = chainTarget(chainSizes[0]!);
  try {
    gl.initRenderTarget(chain);
    downsample(gl, octmap, chainSizes, borderSize, scratch, (mip, level) =>
      gl.copyTextureToTexture(mip.texture, chain.texture, null, null, 0, level)
    );
    return chain;
  } catch (error) {
    chain.dispose();
    throw error;
  }
}

/** Draws the radiance of `source` into Godot's octmap as `layout` lays it out, in `target`. */
function drawRadianceOctmap(
  gl: THREE.WebGLRenderer,
  { radiance, debanding }: RadianceSource,
  layout: SkyOctmapLayout,
  target: THREE.WebGLRenderTarget
): void {
  const pass = radianceOctmapPassFor(gl);
  setUniforms(pass, { radiance, size: layout.size, borderSize: layout.borderSize, debanding });
  drawFullScreen(gl, pass, target);
}

/**
 * Draws roughness layer `layer` of `layout`, filtered from the chain `bakeFromChain` set, as an
 * octmap into layer `targetLayer` and mip `mip` of `target`.
 */
function drawFilteredLayer(
  gl: THREE.WebGLRenderer,
  filter: LayerFilter,
  layer: number,
  layout: SkyOctmapLayout,
  target: THREE.WebGLRenderTarget,
  targetLayer: number,
  mip: number
): void {
  const pass = filter.passFor(gl);
  setUniforms(pass, { layerSize: layout.layerSizes[layer], ...filter.layerUniforms(layer) });
  drawFullScreen(gl, pass, target, targetLayer, mip);
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
 * magnifies by its nearest texel unless told otherwise (three r186 `DataArrayTexture.js:47`).
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

/** The chain's octmap, `size` wide at its first mip, which a filter reads between mips. */
function chainTarget(size: number): THREE.WebGLRenderTarget {
  return withMips(new THREE.WebGLRenderTarget(size, size, MIPMAPPED_TARGET_OPTIONS));
}

/** `target` with a level for each mip, as it filters between them. */
function withMips<T extends THREE.WebGLRenderTarget>(target: T): T {
  target.texture.mipmaps = fullMipChain(target.width);
  return target;
}

/**
 * Every mip down to one texel, so a texture that filters between mips is complete: three sets no
 * `TEXTURE_MAX_LEVEL`. Only the first few are drawn, and each read clamps its lod to those. A render
 * target reads only the count (three r186 `WebGLTextures.js:2050-2054`), which the type of
 * `Texture.mipmaps` does not name.
 */
function fullMipChain(size: number): THREE.Texture['mipmaps'] {
  const levels = Array.from({ length: Math.floor(Math.log2(size)) + 1 }, () => ({}));
  return levels as unknown as THREE.Texture['mipmaps'];
}
