/**
 * Godot's filtered radiance layers of a sky, 1 to 7, which its ambient and its reflections read
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
  MAX_ROUGHNESS_LOD,
  skyOctmapLayout,
  type SkyOctmapLayout,
} from '../../godot/rendering/environment/skyReflection.js';
import { fastFilter } from './fastFilter.js';
import { importanceSampleFilter } from './importanceSampleFilter.js';
import type { LayerFilter } from './layerFilter.js';
import {
  DOWNSAMPLE_FRAGMENT_SHADER,
  OCTMAP_FACE,
  RADIANCE_OCTMAP_FRAGMENT_SHADER,
} from './skyLayerShaders.js';
import { releaseTextures, setUniforms, skyPass } from './skyPass.js';
import type { SkyBake } from './types.js';

/** A group of layers shown as one cube: its first layer, and the face size of each layer from there. */
export interface SkyLayerGroup {
  readonly firstLayer: number;
  readonly faceSizes: readonly number[];
}

/**
 * Godot's layers 1 to 7 in three groups. Within a group each layer halves the one before, so the
 * group is a cube's mip chain and a trilinear read blends two layers as Godot does. A layer's faces
 * are about as fine as the chain mip its filter reads, so the sharp layers' first is about as fine
 * as the 320-wide half-size copy.
 */
export const SKY_LAYER_GROUPS = {
  sharp: { firstLayer: 1, faceSizes: [128, 64, 32] },
  rough: { firstLayer: 4, faceSizes: [32, 16, 8] },
  /** The layer the ambient reads, smooth enough that linear filtering between texels 6 degrees apart follows it. */
  last: { firstLayer: MAX_ROUGHNESS_LOD, faceSizes: [16] },
} as const satisfies Record<string, SkyLayerGroup>;

/** Godot's layers 1 to 7 of a sky, a cube per group with a mip per layer. */
export type SkyLayers = Record<keyof typeof SKY_LAYER_GROUPS, THREE.WebGLCubeRenderTarget>;

/** The groups of layers, each baked into a cube of its own. */
export const SKY_LAYER_GROUP_NAMES = Object.keys(SKY_LAYER_GROUPS) as readonly (keyof SkyLayers)[];

/** A record with `make`'s value for each group. */
export function byGroup<T>(make: (group: keyof SkyLayers) => T): Record<keyof SkyLayers, T> {
  return Object.fromEntries(SKY_LAYER_GROUP_NAMES.map((group) => [group, make(group)])) as Record<
    keyof SkyLayers,
    T
  >;
}

/** Made once per renderer, as each bake would otherwise compile them again. */
const radianceOctmapPassFor = perRenderer(() =>
  skyPass(RADIANCE_OCTMAP_FRAGMENT_SHADER, ['radiance', 'size', 'borderSize'])
);
const downsamplePassFor = perRenderer(() =>
  skyPass(DOWNSAMPLE_FRAGMENT_SHADER, ['source', 'size', 'borderSize'])
);

/** Godot's fast filter, or its importance-sampling filter for an octmap laid out as `layout`. */
function layerFilter(radianceFilter: SkyBake['radianceFilter'], layout: SkyOctmapLayout): LayerFilter {
  return radianceFilter === 'fast' ? fastFilter : importanceSampleFilter(layout);
}

/** Lets go of the textures a bake set on `gl`'s passes, as the passes outlive it. */
function releasePasses(gl: THREE.WebGLRenderer, filter: LayerFilter): void {
  for (const passFor of [radianceOctmapPassFor, downsamplePassFor, filter.passFor])
    releaseTextures(passFor(gl));
}

/**
 * Godot's baked layers of the sky in `radiance`, a cube as wide as the bake's radiance size. The
 * cube stands for Godot's radiance octmap of the same size, which is twice as wide to match a cube's
 * texel density (`sky.cpp:1553-1554`). The caller owns the cubes, and frees them with
 * `disposeSkyLayers`.
 */
export function bakeSkyLayers(
  gl: THREE.WebGLRenderer,
  radiance: THREE.CubeTexture,
  bake: SkyBake
): SkyLayers {
  const filter = layerFilter(bake.radianceFilter, skyOctmapLayout(bake.radianceSize));
  const layers = byGroup((group) => layerCube(SKY_LAYER_GROUPS[group]));
  try {
    bakeFromChain(gl, radiance, filter.layout, filter, (chain) => {
      for (const group of SKY_LAYER_GROUP_NAMES)
        filterGroup(gl, chain, filter, SKY_LAYER_GROUPS[group], layers[group]);
    });
    return layers;
  } catch (error) {
    disposeSkyLayers(layers);
    throw error;
  }
}

export function disposeSkyLayers(layers: SkyLayers): void {
  for (const group of SKY_LAYER_GROUP_NAMES) layers[group].dispose();
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
 * filtered layer into its own mip, as Godot writes a probe's layers (`sky.cpp:310-330`).
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
    const radianceOctmapPass = radianceOctmapPassFor(gl);
    setUniforms(radianceOctmapPass, { radiance, size: layout.size, borderSize: layout.borderSize });
    drawFullScreen(gl, radianceOctmapPass, target, index, 0);
    filterAtlasLayers(gl, chain, filter, atlas, index);
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
 * `chainSizes`. Each mip draws into a target of its own, as a pass cannot read the texture it draws
 * into, and is copied into its level of the chain.
 */
function downsampleChain(
  gl: THREE.WebGLRenderer,
  radiance: THREE.CubeTexture,
  layout: SkyOctmapLayout,
  chainSizes: readonly number[]
): THREE.WebGLRenderTarget {
  const { borderSize } = layout;
  const chain = chainTarget(chainSizes[0]!);
  const octmap = octmapTarget(layout.size);
  const mips = chainSizes.map(octmapTarget);
  const radianceOctmapPass = radianceOctmapPassFor(gl);
  const downsamplePass = downsamplePassFor(gl);
  try {
    setUniforms(radianceOctmapPass, { radiance, size: layout.size, borderSize });
    drawFullScreen(gl, radianceOctmapPass, octmap);
    gl.initRenderTarget(chain);
    mips.forEach((target, mip) => {
      const source = mip === 0 ? octmap : mips[mip - 1]!;
      setUniforms(downsamplePass, { source: source.texture, size: target.width, borderSize });
      drawFullScreen(gl, downsamplePass, target);
      gl.copyTextureToTexture(target.texture, chain.texture, null, null, 0, mip);
    });
    return chain;
  } catch (error) {
    chain.dispose();
    throw error;
  } finally {
    octmap.dispose();
    for (const target of mips) target.dispose();
  }
}

/** Draws each layer of `group` into its mip of `cube`, face by face. */
function filterGroup(
  gl: THREE.WebGLRenderer,
  chain: THREE.WebGLRenderTarget,
  filter: LayerFilter,
  { firstLayer, faceSizes }: SkyLayerGroup,
  cube: THREE.WebGLCubeRenderTarget
): void {
  const { layout, chainSizes } = filter;
  const pass = filter.passFor(gl);
  setUniforms(pass, {
    chain: chain.texture,
    lastMip: chainSizes.length - 1,
    borderSize: layout.borderSize,
  });
  faceSizes.forEach((faceSize, mip) => {
    setUniforms(pass, filter.layerUniforms(firstLayer + mip));
    for (let face = 0; face < 6; face += 1) {
      setUniforms(pass, { face, faceSize });
      drawFullScreen(gl, pass, cube, face, mip);
    }
  });
}

/** Draws layers 1 onwards of `atlas`'s layout into their mips of layer `index`. */
function filterAtlasLayers(
  gl: THREE.WebGLRenderer,
  chain: THREE.WebGLRenderTarget,
  filter: LayerFilter,
  { layout, target }: ReflectionAtlas,
  index: number
): void {
  const { chainSizes } = filter;
  const pass = filter.passFor(gl);
  setUniforms(pass, {
    chain: chain.texture,
    lastMip: chainSizes.length - 1,
    borderSize: layout.borderSize,
    face: OCTMAP_FACE,
  });
  for (let layer = 1; layer < layout.layerSizes.length; layer += 1) {
    setUniforms(pass, filter.layerUniforms(layer));
    setUniforms(pass, { faceSize: layout.layerSizes[layer] });
    drawFullScreen(gl, pass, target, index, layer);
  }
}

/**
 * Half-float targets with no depth. Each clamps to its edge, as Godot's samplers for the sky's
 * octmaps do (`copy_effects.cpp:1155`, `:1366`).
 */
const TARGET_OPTIONS: THREE.RenderTargetOptions = {
  type: THREE.HalfFloatType,
  depthBuffer: false,
  generateMipmaps: false,
  minFilter: THREE.LinearFilter,
};

const MIPMAPPED_TARGET_OPTIONS: THREE.RenderTargetOptions = {
  ...TARGET_OPTIONS,
  minFilter: THREE.LinearMipmapLinearFilter,
};

/** A cube for `group`, a mip per layer when it has more than one. */
function layerCube({ faceSizes }: SkyLayerGroup): THREE.WebGLCubeRenderTarget {
  const size = faceSizes[0]!;
  if (faceSizes.length === 1) return new THREE.WebGLCubeRenderTarget(size, TARGET_OPTIONS);
  return withMips(new THREE.WebGLCubeRenderTarget(size, MIPMAPPED_TARGET_OPTIONS));
}

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
