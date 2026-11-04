/**
 * Godot's screen-space reflection in three's physical lighting: the colour pass lays the traced
 * reflection over the indirect specular, after Godot's occlusion of a reflection
 * (`scene_forward_clustered.glsl:2177-2208`).
 */

import { installChunkEdits } from '../shaderPatch/chunkPatch.js';
import { installLitUniform } from '../shaderPatch/litUniform.js';
import { installGodotIndirectSpecular } from '../godotIndirectSpecular.js';
import { installNormalRoughnessPrepass } from '../screenSpaceEffects/prepassChunk.js';
import { SCREEN_SPACE_READ } from '../screenSpaceEffects/screenSpaceState.js';
import { reflectionSlot, SSR_UNIFORM } from './ssrUniforms.js';
import { ROUGHNESS_FADE } from './ssrShaders.js';

const { reflection } = SSR_UNIFORM;

/**
 * The fade keeps a reflection whole up to `ROUGHNESS_FADE.start` and none from its end, where the
 * trace draws nothing (`:2204`). The caller checks that the render shows its reflection.
 */
const SSR_FUNCTIONS = /* glsl */ `
uniform highp sampler2D ${reflection};
float godotSsrRoughnessFade( float roughness ) {
	return smoothstep( 0.0, 1.0, 1.0 - clamp( ( roughness - ${ROUGHNESS_FADE.start} ) / ( ${ROUGHNESS_FADE.end} - ${ROUGHNESS_FADE.start} ), 0.0, 1.0 ) );
}

vec4 godotScreenSpaceReflection( float roughness ) {
	return texelFetch( ${reflection}, godotResultTexel( ${reflection} ), 0 ) * godotSsrRoughnessFade( roughness );
}
`;

/**
 * Premultiplied, over the indirect specular, which the base layer's weights then scale (`:2207`).
 * Only while a render shows its reflection: the alpha pass and an untraced render read none.
 */
const SSR_FOLD = /* glsl */ `
#if defined( STANDARD )

	if ( ${SCREEN_SPACE_READ.showsReflection} > 0.5 ) {
		vec4 godotSsr = godotScreenSpaceReflection( material.godotRoughness );
		reflectedLight.indirectSpecular = reflectedLight.indirectSpecular * ( 1.0 - godotSsr.a ) + godotIndirectSpecular( godotSsr.rgb, material );
	}

#endif
`;

/**
 * Lays the reflection in every physical program compiled after the call, and gives every lit
 * material the reflection it reads. A second call changes nothing.
 */
export function installGodotScreenSpaceReflection(): boolean {
  const isPatched = installChunkEdits({
    mark: SSR_FOLD,
    patch: 'screen-space reflection',
    // After Godot's occlusion of a reflection, which `installGodotIndirectSpecular` appends.
    append: { lights_physical_pars_fragment: SSR_FUNCTIONS, aomap_fragment: SSR_FOLD },
    requires: [installGodotIndirectSpecular, installNormalRoughnessPrepass],
  });
  if (isPatched) installLitUniform(reflection, reflectionSlot);
  return isPatched;
}
