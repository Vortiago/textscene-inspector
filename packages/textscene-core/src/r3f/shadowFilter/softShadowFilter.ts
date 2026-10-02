/**
 * Godot's soft shadow filter in GLSL for three's chunks, shared by the directional and the positional
 * lookups: the Soft Low kernel, its turn per fragment, and the PCF that samples an atlas through
 * both (`scene_forward_lights_inc.glsl:278-335`). Each lookup's patch puts the block before the
 * lookup that calls it.
 */

import { SOFT_LOW_SHADOW_SAMPLES, vogelDisk } from '../../godot/softShadowKernel.js';
import { FRAMEBUFFER_HEIGHT_UNIFORM } from './framebufferRows.js';

/** A float literal GLSL reads back as the same float32. */
export function glslFloat(value: number): string {
  const text = String(value);
  return /[.e]/.test(text) ? text : `${text}.0`;
}

const KERNEL = vogelDisk(SOFT_LOW_SHADOW_SAMPLES)
  .map(([x, y]) => `vec2( ${glslFloat(x)}, ${glslFloat(y)} )`)
  .join(', ');

/**
 * The macro the block defines. A program with both a sun and a positional shadow holds the block
 * twice, and compiles only the first.
 */
const DECLARED = 'GODOT_SOFT_SHADOW_FILTER';

/**
 * The block. The turn is `quick_hash` of the fragment's position (`:278-281`, `:292-298`), with no
 * TAA frame to offset it, and with its rows counted from the top, as Godot's are
 * (`framebufferRows.ts`). `godotPcf` is `sample_directional_pcf_shadow` (`:283-308`) and
 * `sample_pcf_shadow` (`:310-335`). Both take four taps at the default Soft Low quality
 * (`rendering_server.cpp:3706`, `:3710`), so both read the one kernel.
 */
export const SOFT_SHADOW_FILTER = `
		#ifndef ${DECLARED}
		#define ${DECLARED}
		uniform float ${FRAMEBUFFER_HEIGHT_UNIFORM}[ 1 ];
		const int GODOT_SOFT_SHADOW_SAMPLES = ${SOFT_LOW_SHADOW_SAMPLES};
		const vec2 GODOT_SOFT_SHADOW_KERNEL[ ${SOFT_LOW_SHADOW_SAMPLES} ] = vec2[]( ${KERNEL} );
		mat2 godotDiskRotation() {
			vec2 fragCoord = vec2( gl_FragCoord.x, ${FRAMEBUFFER_HEIGHT_UNIFORM}[ 0 ] - gl_FragCoord.y );
			float r = fract( 52.9829189 * fract( dot( fragCoord, vec2( 0.06711056, 0.00583715 ) ) ) ) * PI2;
			float sr = sin( r );
			float cr = cos( r );
			return mat2( vec2( cr, - sr ), vec2( sr, cr ) );
		}
		float godotPcf( sampler2DShadow atlas, vec2 pixelSize, vec3 coord ) {
			mat2 rotation = godotDiskRotation();
			float shadow = 0.0;
			for ( int i = 0; i < GODOT_SOFT_SHADOW_SAMPLES; i ++ ) {
				vec2 tap = coord.xy + pixelSize * ( rotation * GODOT_SOFT_SHADOW_KERNEL[ i ] );
				shadow += texture( atlas, vec3( tap, coord.z ) );
			}
			return shadow * ( 1.0 / float( GODOT_SOFT_SHADOW_SAMPLES ) );
		}
		#endif
`;
