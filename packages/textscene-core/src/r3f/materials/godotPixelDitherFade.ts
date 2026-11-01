/**
 * Godot's pixel-dither distance fade for three's programs. A fragment is dropped when the smoothstep of
 * its distance from the camera falls below an interleaved gradient noise of its pixel
 * (`scene/resources/material.cpp:1863-1885`).
 */

import type { ProgramInjection } from '../materialProgramInputs';

const FADE_VARYING = 'vGodotFadeDistance';

const VERTEX_DISTANCE = `${FADE_VARYING} = length( mvPosition.xyz );`;

/** The hard cap at 0.001 stops a few stray pixels remaining past the fade-out distance. */
const FRAGMENT_DISCARD = /* glsl */ `
	{
		float fade = clamp( smoothstep( godotFadeMin, godotFadeMax, ${FADE_VARYING} ), 0.0, 1.0 );
		if ( fade < 0.001 || fade < fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) ) ) discard;
	}
`;

/** The fade over distances `min` to `max`, which are uniforms: one program serves every range. */
export function pixelDitherFade(min: number, max: number): ProgramInjection {
  return {
    cacheKey: 'godot-pixel-dither-fade',
    onBeforeCompile(shader) {
      shader.uniforms.godotFadeMin = { value: min };
      shader.uniforms.godotFadeMax = { value: max };
      shader.vertexShader = `varying float ${FADE_VARYING};\n${shader.vertexShader}`.replace(
        '#include <project_vertex>',
        `#include <project_vertex>\n${VERTEX_DISTANCE}`
      );
      shader.fragmentShader =
        `varying float ${FADE_VARYING};\nuniform float godotFadeMin;\nuniform float godotFadeMax;\n${shader.fragmentShader}`.replace(
          'void main() {',
          `void main() {${FRAGMENT_DISCARD}`
        );
    },
  };
}
