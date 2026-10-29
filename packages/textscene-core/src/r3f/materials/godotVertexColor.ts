/**
 * Godot's `vertex_color_is_srgb`: the material's vertex code decodes COLOR from sRGB to linear
 * (`material.cpp:1218-1227`), after the instance colour has multiplied it. three reads a vertex
 * colour as linear.
 */

import type { ProgramInjection } from '../materialProgramInputs';
import { editedProgram } from '../shaderPatch/chunkPatch';

const COLOR_CHUNK = '#include <color_vertex>';

/** Forward+ draws to a linear target, so Godot's `!OUTPUT_IS_SRGB` branch always runs. */
const SRGB_DECODE = /* glsl */ `${COLOR_CHUNK}
#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	vColor.rgb = mix(
		pow( ( vColor.rgb + vec3( 0.055 ) ) * ( 1.0 / ( 1.0 + 0.055 ) ), vec3( 2.4 ) ),
		vColor.rgb * ( 1.0 / 12.92 ),
		lessThan( vColor.rgb, vec3( 0.04045 ) ) );
#endif`;

/**
 * The decode of a surface that reads its vertex colour as albedo. A later injection that edits the
 * colour chunk lands before it, as Godot's instance colour does.
 */
export const SRGB_VERTEX_COLOR: ProgramInjection = {
  cacheKey: 'godot-srgb-vertex-color',
  onBeforeCompile(shader) {
    editedProgram(shader, { vertex: [{ three: COLOR_CHUNK, godot: SRGB_DECODE }] }, 'sRGB vertex colour');
  },
};
