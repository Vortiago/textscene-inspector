/**
 * Godot's tile texture padding in a three program. Godot draws a padded tile from a copy of the
 * atlas with a one-pixel border repeated from the tile's own edge (`tile_set.cpp:5622-5671`), so a
 * filtered sample at the edge never reads the neighbouring tile. Clamping the sample to the tile's
 * outer texel centres reads the same texels, and keeps the atlas's own bytes.
 */

import * as THREE from 'three';
import type { ProgramInjection } from './materialProgramInputs';

/** The per-vertex attribute that holds a tile's bounds, `tileGeometry.ts`'s `uvBounds`. */
export const TILE_UV_BOUNDS_ATTRIBUTE = 'tileUvBounds';

const MAP_SAMPLE = 'texture2D( map, vMapUv )';
const CLAMPED_MAP_SAMPLE = 'texture2D( map, clamp( vMapUv, vTileUvBounds.xy, vTileUvBounds.zw ) )';

/** `shader` with `include` followed by `addition`, or a throw that names the missing include. */
function after(shader: string, include: string, addition: string): string {
  if (!shader.includes(include)) throw new Error(`tile texture padding: expected ${include} in the program`);
  return shader.replace(include, () => `${include}\n${addition}`);
}

/**
 * The map chunk as it stands when the program compiles, the canvas sRGB multiply included, with its
 * sample clamped. Inlined, since `#include` resolves after `onBeforeCompile`.
 */
function clampedMapFragment(): string {
  const chunk = THREE.ShaderChunk.map_fragment;
  if (chunk.split(MAP_SAMPLE).length !== 2) {
    throw new Error(`tile texture padding: expected one ${MAP_SAMPLE} in map_fragment`);
  }
  return chunk.replace(MAP_SAMPLE, () => CLAMPED_MAP_SAMPLE);
}

export const TILE_TEXTURE_PADDING: ProgramInjection = {
  cacheKey: 'tile-texture-padding',
  onBeforeCompile(shader) {
    shader.vertexShader = after(
      after(
        shader.vertexShader,
        '#include <uv_pars_vertex>',
        `attribute vec4 ${TILE_UV_BOUNDS_ATTRIBUTE};\nvarying vec4 vTileUvBounds;`
      ),
      '#include <uv_vertex>',
      `vTileUvBounds = ${TILE_UV_BOUNDS_ATTRIBUTE};`
    );
    shader.fragmentShader = after(
      shader.fragmentShader,
      '#include <uv_pars_fragment>',
      'varying vec4 vTileUvBounds;'
    ).replace('#include <map_fragment>', clampedMapFragment);
  },
};
