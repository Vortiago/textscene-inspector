/**
 * Godot's soft shadow filter in three's shadow chunk, shared by the directional and the positional
 * lookups: the Soft Low kernel, its turn per fragment, and the PCF that samples an atlas through
 * both (`scene_forward_lights_inc.glsl:278-335`). Each lookup's installer installs it first.
 */

import { SOFT_LOW_SHADOW_SAMPLES, vogelDisk } from '../../godot/softShadowKernel.js';
import { glslFloat } from '../../resources/environment/glslLiterals.js';
import {
  applyChunkEdits,
  installChunkPatch,
  onChunk,
  type ChunkEdit,
  type ChunkPatch,
} from '../shaderPatch/chunkPatch.js';
import { FRAMEBUFFER_HEIGHT_UNIFORM, installFramebufferHeightUniform } from './framebufferRows.js';

const CHUNK = 'shadowmap_pars_fragment';

const KERNEL = vogelDisk(SOFT_LOW_SHADOW_SAMPLES)
  .map(([x, y]) => `vec2( ${glslFloat(x)}, ${glslFloat(y)} )`)
  .join(', ');

/**
 * The block. The turn is `quick_hash` of the fragment's position (`:278-281`, `:292-298`), with no
 * TAA frame to offset it, and with its rows counted from the top, as Godot's are
 * (`framebufferRows.ts`). `godotPcf` is `sample_directional_pcf_shadow` (`:283-308`) and
 * `sample_pcf_shadow` (`:310-335`). Both take four taps at the default Soft Low quality
 * (`rendering_server.cpp:3706`, `:3710`), so both read the one kernel.
 */
export const SOFT_SHADOW_FILTER = `	uniform float ${FRAMEBUFFER_HEIGHT_UNIFORM}[ 1 ];
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
`;

/**
 * The block goes inside `#ifdef USE_SHADOWMAP`, ahead of every shadow block, so every lookup that
 * calls it follows it. The anchor omits the slot count, which `splitShadowChunk.ts` rewrites, and
 * follows the line `shadowFade.ts` inserts after, so every install order gives the same chunk.
 */
const SUN_BLOCK_START = '\t#if NUM_SUN_LIGHT_SHADOWS > 0\n\t\t#define SUN_LIGHT_CASCADES';

const FILTER_EDIT: ChunkEdit<typeof CHUNK> = {
  chunk: CHUNK,
  three: SUN_BLOCK_START,
  godot: SOFT_SHADOW_FILTER + SUN_BLOCK_START,
};

/** The shadow chunk with the filter in, or null when it lacks the sun block the filter precedes. */
export function softShadowFilterChunk(chunk: string): string | null {
  return applyChunkEdits({ [CHUNK]: chunk }, [FILTER_EDIT])?.[CHUNK] ?? null;
}

const SOFT_SHADOW_FILTER_PATCH: ChunkPatch<typeof CHUNK> = {
  names: [CHUNK],
  isApplied: (chunks) => chunks[CHUNK].includes('float godotPcf('),
  apply: onChunk(CHUNK, softShadowFilterChunk),
  missing: `${CHUNK} has no sun shadow block for the soft shadow filter to precede`,
};

/**
 * Puts the filter in three's shadow chunk, and gives every lit material the framebuffer height it
 * reads, for every program compiled after the call. True when the chunk holds the filter after the
 * call, so the caller's lookups may call it. A second call changes nothing.
 */
export function installSoftShadowFilter(): boolean {
  if (!installChunkPatch(SOFT_SHADOW_FILTER_PATCH)) return false;
  installFramebufferHeightUniform();
  return true;
}
