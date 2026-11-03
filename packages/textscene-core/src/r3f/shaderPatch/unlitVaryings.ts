/**
 * The view position and view normal of three's unlit program, which its vertex program computes only
 * for an environment map or a skin. The decals mix on both, and the normal-roughness prepass writes
 * the normal, as Godot's shaders read the interpolated normal of an unshaded surface too
 * (`scene_forward_clustered_inc.glsl:16-20`).
 */

import { installChunkEdits, type TextEdit } from './chunkPatch.js';

/** `mvPosition.xyz`, the fragment's position in view space. */
export const UNLIT_VIEW_VARYING = 'vGodotUnlitView';

/** three's `transformedNormal`: skinned, morphed and flipped for a back-side material, not normalised. */
export const UNLIT_NORMAL_VARYING = 'vGodotUnlitNormal';

const DECLARATIONS = `varying vec3 ${UNLIT_VIEW_VARYING};\nvarying vec3 ${UNLIT_NORMAL_VARYING};\n`;

const THREE_MAIN = 'void main() {';

/** three's guard on the normal chunks, which only an environment map or a skin passes. */
const THREE_NORMAL_GUARD = '#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )';

const VERTEX_EDITS: readonly TextEdit[] = [
  { three: THREE_MAIN, godot: `${DECLARATIONS}${THREE_MAIN}` },
  { three: THREE_NORMAL_GUARD, godot: '#if 1' },
  {
    three: '#include <project_vertex>',
    godot: `#include <project_vertex>\n\t${UNLIT_VIEW_VARYING} = mvPosition.xyz;\n\t${UNLIT_NORMAL_VARYING} = transformedNormal;`,
  },
];

const FRAGMENT_EDITS: readonly TextEdit[] = [{ three: THREE_MAIN, godot: `${DECLARATIONS}${THREE_MAIN}` }];

/**
 * Gives every unlit program compiled after the call both varyings, and `transformedNormal` in its
 * vertex program. A second call changes nothing.
 *
 * @canonical The view position and normal of three's unlit program
 */
export function installUnlitVaryings(): boolean {
  return installChunkEdits({
    mark: DECLARATIONS,
    patch: 'unlit varyings',
    fragmentShaders: { basic: FRAGMENT_EDITS },
    vertexShaders: { basic: VERTEX_EDITS },
  });
}
