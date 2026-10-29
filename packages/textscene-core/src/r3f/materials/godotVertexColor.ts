/**
 * Godot's `vertex_color_is_srgb`: the material's vertex code decodes COLOR from sRGB to linear
 * (`material.cpp:1218-1227`), after the instance colour has multiplied it. three reads a vertex
 * colour as linear.
 */

import type { ProgramInjection } from '../materialProgramInputs';
import { editedProgram, type TextEdit } from '../shaderPatch/chunkPatch';

/** three's chunk that writes `vColor`, the vertex colour the fragment multiplies into the albedo. */
export const VERTEX_COLOR_CHUNK = '#include <color_vertex>';

/** The edit that runs `glsl` on `vColor` after three writes it, where three draws vertex colours. */
export function afterVertexColor(glsl: string): TextEdit {
  return {
    three: VERTEX_COLOR_CHUNK,
    godot: `${VERTEX_COLOR_CHUNK}
#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
${glsl}
#endif`,
  };
}

/**
 * `material.cpp`'s own text, not `godotToLinear`, which clamps a negative channel this decode keeps.
 * Forward+ draws to a linear target, so Godot's `!OUTPUT_IS_SRGB` branch always runs.
 */
const SRGB_DECODE = /* glsl */ `	vColor.rgb = mix(
		pow( ( vColor.rgb + vec3( 0.055 ) ) * ( 1.0 / ( 1.0 + 0.055 ) ), vec3( 2.4 ) ),
		vColor.rgb * ( 1.0 / 12.92 ),
		lessThan( vColor.rgb, vec3( 0.04045 ) ) );`;

/**
 * The decode of a surface that reads its vertex colour as albedo. A later injection that edits the
 * colour chunk lands before it, as Godot's instance colour does.
 */
export const SRGB_VERTEX_COLOR: ProgramInjection = {
  cacheKey: 'godot-srgb-vertex-color',
  onBeforeCompile(shader) {
    editedProgram(shader, { vertex: [afterVertexColor(SRGB_DECODE)] }, 'sRGB vertex colour');
  },
};
