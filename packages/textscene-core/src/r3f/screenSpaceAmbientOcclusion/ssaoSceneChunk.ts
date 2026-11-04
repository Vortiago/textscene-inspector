/**
 * Godot's screen-space ambient occlusion in three's physical lighting: the colour pass folds the
 * occlusion at its own pixel into the surface's `ao`, and its light affect into `ao_light_affect`,
 * before either occludes a light (`scene_forward_clustered.glsl:2033-2041`).
 */

import { installChunkEdits } from '../shaderPatch/chunkPatch.js';
import { installLitUniform } from '../shaderPatch/litUniform.js';
import {
  installGodotOcclusion,
  LIGHT_AFFECT,
  SURFACE_OCCLUSION,
} from '../materials/godotAmbientOcclusion.js';
import { installNormalRoughnessPrepass } from '../screenSpaceEffects/prepassChunk.js';
import { SCREEN_SPACE_UNIFORM } from '../screenSpaceEffects/screenSpaceState.js';
import { occlusionFold, occlusionSlot, SSAO_UNIFORM } from './ssaoUniforms.js';

const { occlusion, fold } = SSAO_UNIFORM;
const { state } = SCREEN_SPACE_UNIFORM;

/**
 * The occlusion at the fragment's pixel, or Godot's black default. It holds Godot's rows, top row
 * first, so the read flips three's bottom-up row. It is full size, so Godot's linear read at the
 * pixel's centre is the texel.
 */
const SSAO_PARS = /* glsl */ `
uniform highp sampler2D ${occlusion};
uniform vec3 ${fold};
float godotScreenSpaceOcclusion() {
	if ( ${fold}.z < 0.5 ) return 0.0;
	ivec2 pixel = ivec2( gl_FragCoord.xy );
	pixel.y = textureSize( ${occlusion}, 0 ).y - 1 - pixel.y;
	return texelFetch( ${occlusion}, pixel, 0 ).r;
}
`;

/** Only in a lit program while a render shows its occlusion: the alpha pass and a probe read none. */
const SURFACE_FOLD = /* glsl */ `
	#if defined( STANDARD )
		if ( ${state}.w > 0.5 ) {
			ambientOcclusion = min( ambientOcclusion, godotScreenSpaceOcclusion() );
			${LIGHT_AFFECT} = mix( ${LIGHT_AFFECT}, max( ${LIGHT_AFFECT}, ${fold}.x ), ${fold}.y );
		}
	#endif`;

/**
 * Folds the occlusion into every physical program compiled after the call, and gives every lit
 * material the occlusion it reads. A second call changes nothing.
 */
export function installGodotScreenSpaceAmbientOcclusion(): boolean {
  const isPatched = installChunkEdits({
    edits: [
      { chunk: 'aomap_fragment', three: SURFACE_OCCLUSION, godot: `${SURFACE_OCCLUSION}${SURFACE_FOLD}` },
    ],
    mark: SURFACE_FOLD,
    patch: 'screen-space ambient occlusion',
    append: { lights_physical_pars_fragment: SSAO_PARS },
    requires: [installGodotOcclusion, installNormalRoughnessPrepass],
  });
  if (!isPatched) return false;
  installLitUniform(occlusion, occlusionSlot);
  installLitUniform(fold, occlusionFold);
  return true;
}
