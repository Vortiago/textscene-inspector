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
 * Godot's radiance layers of a sky as its octmap array (`sky.cpp:1545-1576`): an array layer per
 * roughness layer, from layer 0, the radiance, each with a mip chain of its own. A read clamps its
 * mip to the last of `layout.mipSizes`, as Godot's texture ends there.
 */
export interface SkyLayers {
  readonly layout: SkyRadianceLayout;
  readonly target: THREE.WebGLArrayRenderTarget;
}

/** Made once per renderer, as each bake would otherwise compile them again. */
const radianceOctmapPassFor = perRenderer(() =>
  skyPass(RADIANCE_OCTMAP_FRAGMENT_SHADER, ['radiance', 'size', 'borderSize'])
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

/** Lets go of the textures a bake set on `gl`'s passes, as the passes outlive it. */
function releasePasses(gl: THREE.WebGLRenderer, filter: LayerFilter): void {
  for (const passFor of [radianceOctmapPassFor, downsamplePassFor, filter.passFor])
    releaseTextures(passFor(gl));
}

/**
 * Godot's baked layers of the sky in `radiance`, a cube as wide as the bake's radiance size. The
 * cube stands for Godot's radiance octmap of the same size, which is twice as wide to match a cube's
 * texel density (`sky.cpp:1554-1557`). Each layer's mips shrink its mip 0 as Godot's
 * `update_reflection_mipmaps` does (`sky.cpp:481-500`). The caller owns the array, and frees it with
 * `disposeSkyLayers`.
 */
export function bakeSkyLayers(
  gl: THREE.WebGLRenderer,
  radiance: THREE.CubeTexture,
  bake: SkyBake
): SkyLayers {
  const layout = skyLayersLayout(bake);
  const filter = layerFilter(bake.radianceFilter, layout);
  const target = new THREE.WebGLArrayRenderTarget(
    layout.size,
    layout.size,
    layout.layerSizes.length,
    MIPMAPPED_TARGET_OPTIONS
  );
  const layers = { layout, target: withMips(target) };
  try {
    bakeFromChain(gl, radiance, layout, filter, (chain) => {
      gl.initRenderTarget(target);
      layout.layerSizes.forEach((_, layer) => {
        drawSkyLayer(gl, layers, layer, (into) => {
          if (layer === 0) drawRadianceOctmap(gl, radiance, layout, into.target);
          else drawFilteredLayer(gl, chain, filter, layer, layout, into);
        });
      });
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

/**
 * Godot's reflection atlas (`light_storage.cpp:1487-1590`): a layer of the texture array per probe,
 * each an octmap with a mip per Godot layer. A read clamps its lod to the last layer, as Godot's
 * texture ends there.
 */
export interface ReflectionAtlas {
  readonly layout: SkyOctmapLayout;
  readonly target: THREE.WebGLArrayRenderTarget;
}

/** An atlas of `probeCount` layers laid out as `layout`. The caller owns its target. */
export function createReflectionAtlas(layout: SkyOctmapLayout, probeCount: number): ReflectionAtlas {
  // A texture array needs a layer, so an atlas of no probes holds one nothing reads.
  const depth = Math.max(probeCount, 1);
  const target = new THREE.WebGLArrayRenderTarget(layout.size, layout.size, depth, MIPMAPPED_TARGET_OPTIONS);
  return { layout, target: withMips(target) };
}

/**
 * Draws the capture in `radiance` into layer `index` of `atlas`: the radiance into mip 0, and each
 * filtered layer into its own mip, as Godot writes a probe's layers (`sky.cpp:313-333`).
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
  bakeFromChain(gl, radiance, layout, filter, (chain) => {
    drawRadianceOctmap(gl, radiance, layout, target, index);
    for (let layer = 1; layer < layout.layerSizes.length; layer += 1)
      drawFilteredLayer(gl, chain, filter, layer, layout, { target, layer: index, mip: layer });
  });
}

/**
 * The bake both of Godot's layer sets share: `drawLayers` draws from the downsample chain of
 * `radiance`, laid out as `layout`, into targets of its own, and leaves the renderer as it found it.
 */
function bakeFromChain(
  gl: THREE.WebGLRenderer,
  radiance: THREE.CubeTexture,
  layout: SkyOctmapLayout,
  filter: LayerFilter,
  drawLayers: (chain: THREE.WebGLRenderTarget) => void
): void {
  try {
    drawOffscreen(gl, () => {
      const chain = downsampleChain(gl, radiance, layout, filter.chainSizes);
      try {
        drawLayers(chain);
      } finally {
        chain.dispose();
      }
    });
  } finally {
    releasePasses(gl, filter);
  }
}

/**
 * The radiance drawn into Godot's octmap as `layout` lays it out, then shrunk to each mip of
 * `chainSizes`, into the chain a filter reads.
 */
function downsampleChain(
  gl: THREE.WebGLRenderer,
  radiance: THREE.CubeTexture,
  layout: SkyOctmapLayout,
  chainSizes: readonly number[]
): THREE.WebGLRenderTarget {
  const chain = chainTarget(chainSizes[0]!);
  const octmap = octmapTarget(layout.size);
  try {
    drawRadianceOctmap(gl, radiance, layout, octmap);
    gl.initRenderTarget(chain);
    downsample(gl, octmap, chainSizes, layout.borderSize, (mip, level) =>
      gl.copyTextureToTexture(mip.texture, chain.texture, null, null, 0, level)
    );
    return chain;
  } catch (error) {
    chain.dispose();
    throw error;
  } finally {
    octmap.dispose();
  }
}

/** Where a pass draws: a layer and a mip of a target, as `drawFullScreen` takes them. */
interface DrawTarget {
  target: THREE.WebGLRenderTarget;
  layer: number;
  mip: number;
}

/** Draws the radiance in `radiance` into Godot's octmap as `layout` lays it out, in `layer` of `target`. */
function drawRadianceOctmap(
  gl: THREE.WebGLRenderer,
  radiance: THREE.CubeTexture,
  layout: SkyOctmapLayout,
  target: THREE.WebGLRenderTarget,
  layer = 0
): void {
  const pass = radianceOctmapPassFor(gl);
  setUniforms(pass, { radiance, size: layout.size, borderSize: layout.borderSize });
  drawFullScreen(gl, pass, target, layer, 0);
}

/** Draws roughness layer `layer` of `layout`, filtered from `chain`, as an octmap into `into`. */
function drawFilteredLayer(
  gl: THREE.WebGLRenderer,
  chain: THREE.WebGLRenderTarget,
  filter: LayerFilter,
  layer: number,
  layout: SkyOctmapLayout,
  into: DrawTarget
): void {
  const pass = filter.passFor(gl);
  setUniforms(pass, {
    chain: chain.texture,
    lastMip: filter.chainSizes.length - 1,
    borderSize: layout.borderSize,
    layerSize: layout.layerSizes[layer],
  });
  setUniforms(pass, filter.layerUniforms(layer));
  drawFullScreen(gl, pass, into.target, into.layer, into.mip);
}

/**
 * Shrinks `source` to each of `sizes` in turn, each mip from the one before
 * (`octmap_downsampler.glsl`), and hands each to `keep` with its index. Each mip draws into a target
 * of its own, as a pass cannot read the texture it draws into, so `keep` copies it out.
 */
function downsample(
  gl: THREE.WebGLRenderer,
  source: THREE.WebGLRenderTarget,
  sizes: readonly number[],
  borderSize: number,
  keep: (mip: THREE.WebGLRenderTarget, index: number) => void
): void {
  const pass = downsamplePassFor(gl);
  const mips = sizes.map(octmapTarget);
  try {
    mips.forEach((target, index) => {
      const from = index === 0 ? source : mips[index - 1]!;
      setUniforms(pass, { source: from.texture, size: target.width, borderSize });
      drawFullScreen(gl, pass, target);
      keep(target, index);
    });
  } finally {
    for (const target of mips) target.dispose();
  }
}

/**
 * Draws layer `layer` of `layers`: `drawMip0` draws its mip 0 into an octmap, which `downsample`
 * shrinks to each of its other mips (`sky.cpp:481-500`).
 */
function drawSkyLayer(
  gl: THREE.WebGLRenderer,
  { layout, target }: SkyLayers,
  layer: number,
  drawMip0: (into: DrawTarget) => void
): void {
  const position = new THREE.Vector3(0, 0, layer);
  const keep = (mip: THREE.WebGLRenderTarget, level: number) =>
    gl.copyTextureToTexture(mip.texture, target.texture, null, position, 0, level);
  const mip0 = octmapTarget(layout.size);
  try {
    drawMip0({ target: mip0, layer: 0, mip: 0 });
    keep(mip0, 0);
    downsample(gl, mip0, layout.mipSizes.slice(1), layout.borderSize, (mip, index) => keep(mip, index + 1));
  } finally {
    mip0.dispose();
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

/** An octmap `size` wide, drawn at one level. */
function octmapTarget(size: number): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(size, size, TARGET_OPTIONS);
}

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
