/**
 * A tile's flips and transpose in a three program, for the normal map of its CanvasTexture. The
 * geometry's UVs carry the diffuse through each orientation, so a normal-mapped program samples its
 * map where the diffuse is and turns the normal here (`canvas.glsl:655-661`).
 */

import type { ProgramInjection } from './materialProgramInputs';
import { afterInclude, editedProgram } from './shaderPatch/chunkPatch';

/** The per-vertex attribute that holds a tile's orientation, `tileGeometry.ts`'s `orientations`. */
export const TILE_NORMAL_ORIENTATION_ATTRIBUTE = 'tileNormalOrientation';

export const TILE_NORMAL_ORIENTATION: ProgramInjection = {
  cacheKey: 'tile-normal-orientation',
  onBeforeCompile(shader) {
    editedProgram(
      shader,
      {
        vertex: [
          afterInclude(
            '#include <uv_pars_vertex>',
            `attribute float ${TILE_NORMAL_ORIENTATION_ATTRIBUTE};\nvarying float vTileNormalOrientation;`
          ),
          afterInclude(
            '#include <uv_vertex>',
            `vTileNormalOrientation = ${TILE_NORMAL_ORIENTATION_ATTRIBUTE};`
          ),
        ],
        fragment: [
          // The define tells a normal-mapped program to turn its normal (`normalMappedLighting.ts`).
          afterInclude(
            '#include <uv_pars_fragment>',
            '#define TILE_NORMAL_ORIENTATION\nvarying float vTileNormalOrientation;'
          ),
        ],
      },
      'tile normal orientation'
    );
  },
};
