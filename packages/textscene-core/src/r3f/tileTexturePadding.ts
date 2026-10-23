/**
 * Godot's tile texture padding in a three program. Godot draws a padded tile from a copy of the
 * atlas with a one-pixel border repeated from the tile's own edge (`tile_set.cpp:5622-5671`), so a
 * filtered sample at the edge never reads the neighbouring tile. Clamping the sample to the tile's
 * outer texel centres reads the same texels, and keeps the atlas's own bytes.
 */

import type { ProgramInjection } from './materialProgramInputs';
import { editedChunk, editedProgram, type TextEdit } from './shaderPatch/chunkPatch';

/** The per-vertex attribute that holds a tile's bounds, `tileGeometry.ts`'s `uvBounds`. */
export const TILE_UV_BOUNDS_ATTRIBUTE = 'tileUvBounds';

/** `include` followed by `addition`. */
function after(include: string, addition: string): TextEdit {
  return { three: include, godot: `${include}\n${addition}` };
}

/**
 * The map chunk as it stands when the program compiles, the canvas sRGB multiply included, with its
 * sample clamped. Inlined, since `#include` resolves after `onBeforeCompile`.
 */
function clampedMapFragment(): string {
  return editedChunk('map_fragment', {
    three: 'texture2D( map, vMapUv )',
    godot: 'texture2D( map, clamp( vMapUv, vTileUvBounds.xy, vTileUvBounds.zw ) )',
  });
}

export const TILE_TEXTURE_PADDING: ProgramInjection = {
  cacheKey: 'tile-texture-padding',
  onBeforeCompile(shader) {
    editedProgram(
      shader,
      {
        vertex: [
          after(
            '#include <uv_pars_vertex>',
            `attribute vec4 ${TILE_UV_BOUNDS_ATTRIBUTE};\nvarying vec4 vTileUvBounds;`
          ),
          after('#include <uv_vertex>', `vTileUvBounds = ${TILE_UV_BOUNDS_ATTRIBUTE};`),
        ],
        fragment: [
          after('#include <uv_pars_fragment>', 'varying vec4 vTileUvBounds;'),
          { three: '#include <map_fragment>', godot: clampedMapFragment() },
        ],
      },
      'tile texture padding'
    );
  },
};
