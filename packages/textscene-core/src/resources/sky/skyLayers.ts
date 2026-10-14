/**
 * Godot's filtered radiance layers of a sky, 1 to 7, which its ambient and its reflections read
 * (`scene_forward_clustered.glsl:1714-1756`), baked on the GPU as Godot bakes them. Layer 0 is the
 * radiance itself. A pass draws the radiance into Godot's octmap, a chain of downsamples shrinks it
 * to 10 texels wide, and a filter per layer reads that chain around each direction: GGX importance
 * sampling, or the fast filter of a real-time sky. Nothing comes back to the CPU.
 */

import * as THREE from 'three';
import { drawOffscreen } from '../../r3f/offscreen.js';
import { SKY_ROUGHNESS_LAYERS_DEFAULT } from '../../godot/skyReflection.js';
import { fastFilter } from './fastFilter.js';
import { importanceSampleFilter } from './importanceSampleFilter.js';
import type { LayerFilter } from './layerFilter.js';
import { DOWNSAMPLE_FRAGMENT_SHADER, RADIANCE_OCTMAP_FRAGMENT_SHADER } from './skyLayerShaders.js';
import { draw, releaseTextures, setUniforms, skyPass } from './skyPass.js';
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
  last: { firstLayer: SKY_ROUGHNESS_LAYERS_DEFAULT - 1, faceSizes: [16] },
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

/** Made once, as each bake would otherwise compile them again. */
const radianceOctmapPass = skyPass(RADIANCE_OCTMAP_FRAGMENT_SHADER, ['radiance', 'size', 'borderSize']);
const downsamplePass = skyPass(DOWNSAMPLE_FRAGMENT_SHADER, ['source', 'size', 'borderSize']);

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
  const filter = bake.radianceFilter === 'fast' ? fastFilter : importanceSampleFilter(bake.radianceSize);
  const layers = byGroup((group) => layerCube(SKY_LAYER_GROUPS[group]));
  try {
    drawOffscreen(gl, () => {
      const chain = downsampleChain(gl, radiance, filter);
      try {
        for (const group of SKY_LAYER_GROUP_NAMES)
          filterGroup(gl, chain, filter, SKY_LAYER_GROUPS[group], layers[group]);
      } finally {
        chain.dispose();
      }
    });
    return layers;
  } catch (error) {
    disposeSkyLayers(layers);
    throw error;
  } finally {
    for (const pass of [radianceOctmapPass, downsamplePass, filter.pass]) releaseTextures(pass);
  }
}

export function disposeSkyLayers(layers: SkyLayers): void {
  for (const group of SKY_LAYER_GROUP_NAMES) layers[group].dispose();
}

/**
 * The radiance drawn into Godot's octmap, then shrunk to each mip of `filter`'s chain. Each mip draws
 * into a target of its own, as a pass cannot read the texture it draws into, and is copied into
 * its level of the chain.
 */
function downsampleChain(
  gl: THREE.WebGLRenderer,
  radiance: THREE.CubeTexture,
  { layout, chainSizes }: LayerFilter
): THREE.WebGLRenderTarget {
  const { borderSize } = layout;
  const chain = octmapTarget(chainSizes[0]!, true);
  const octmap = octmapTarget(layout.size, false);
  const mips = chainSizes.map((size) => octmapTarget(size, false));
  try {
    setUniforms(radianceOctmapPass, { radiance, size: layout.size, borderSize });
    draw(gl, radianceOctmapPass, octmap);
    gl.initRenderTarget(chain);
    mips.forEach((target, mip) => {
      const source = mip === 0 ? octmap : mips[mip - 1]!;
      setUniforms(downsamplePass, { source: source.texture, size: target.width, borderSize });
      draw(gl, downsamplePass, target);
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
  const { pass, layout, chainSizes } = filter;
  setUniforms(pass, {
    chain: chain.texture,
    lastMip: chainSizes.length - 1,
    borderSize: layout.borderSize,
  });
  faceSizes.forEach((faceSize, mip) => {
    filter.selectLayer(firstLayer + mip);
    for (let face = 0; face < 6; face += 1) {
      setUniforms(pass, { face, faceSize });
      draw(gl, pass, cube, face, mip);
    }
  });
}

/** A cube for `group`, a mip per layer when it has more than one. */
function layerCube({ faceSizes }: SkyLayerGroup): THREE.WebGLCubeRenderTarget {
  return withMips(new THREE.WebGLCubeRenderTarget(faceSizes[0]!, layerTargetOptions(faceSizes.length > 1)));
}

/** An octmap `size` wide that clamps to its edge, as Godot's samplers for it do (`copy_effects.cpp:1155`, `:1366`). */
function octmapTarget(size: number, hasMips: boolean): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(size, size, layerTargetOptions(hasMips));
  return hasMips ? withMips(target) : target;
}

function layerTargetOptions(hasMips: boolean): THREE.RenderTargetOptions {
  return {
    type: THREE.HalfFloatType,
    depthBuffer: false,
    generateMipmaps: false,
    minFilter: hasMips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter,
  };
}

/** `target` with a level for each mip, when it filters between them. */
function withMips<T extends THREE.WebGLRenderTarget>(target: T): T {
  if (target.texture.minFilter === THREE.LinearMipmapLinearFilter)
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
