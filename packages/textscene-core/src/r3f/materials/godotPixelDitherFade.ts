/**
 * Godot's pixel-dither distance fade for three's programs. A fragment is dropped when the smoothstep of
 * its distance from the camera falls below an interleaved gradient noise of its pixel
 * (`scene/resources/material.cpp:1863-1885`).
 */

import { GODOT_QUICK_HASH_GLSL } from '../../godot/rendering/quickHash';
import type { ProgramInjection } from '../materialProgramInputs';
import { editedProgram } from '../shaderPatch/chunkPatch';

const FADE_VARYING = 'vGodotFadeDistance';

const PROJECT_VERTEX = '#include <project_vertex>';
const MAIN = 'void main() {';

/** The hard cap at 0.001 stops a few stray pixels remaining past the fade-out distance. */
const FRAGMENT_DISCARD = /* glsl */ `
	{
		float fade = smoothstep( godotFadeMin, godotFadeMax, ${FADE_VARYING} );
		if ( fade < 0.001 || fade < godotQuickHash( gl_FragCoord.xy ) ) discard;
	}
`;

/** The fade over distances `min` to `max`, which are uniforms: one program serves every range. */
export function pixelDitherFade(min: number, max: number): ProgramInjection {
  return {
    cacheKey: 'godot-pixel-dither-fade',
    onBeforeCompile(shader) {
      shader.uniforms.godotFadeMin = { value: min };
      shader.uniforms.godotFadeMax = { value: max };
      editedProgram(
        shader,
        {
          vertex: [
            {
              three: PROJECT_VERTEX,
              godot: `${PROJECT_VERTEX}\n${FADE_VARYING} = length( mvPosition.xyz );`,
            },
            { three: MAIN, godot: `varying float ${FADE_VARYING};\n${MAIN}` },
          ],
          fragment: [
            {
              three: MAIN,
              godot: `varying float ${FADE_VARYING};\nuniform float godotFadeMin;\nuniform float godotFadeMax;\n${GODOT_QUICK_HASH_GLSL}\n${MAIN}${FRAGMENT_DISCARD}`,
            },
          ],
        },
        'pixel dither fade'
      );
    },
  };
}
