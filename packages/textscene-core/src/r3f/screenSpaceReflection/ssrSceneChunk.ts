/**
 * Godot's screen-space reflection in three's physical lighting. The normal-roughness prepass draws
 * each lit surface through its own program, which writes its view normal and its roughness in place
 * of its colour (`scene_forward_clustered.glsl:2912-2920`). The colour pass lays the traced
 * reflection over the indirect specular, after Godot's occlusion of a reflection (`:2177-2208`).
 */

import { installChunkEdits, type TextEdit } from '../shaderPatch/chunkPatch.js';
import { FOG_UNIFORMS_MERGE, installLitUniform, installMergedUniform } from '../shaderPatch/litUniform.js';
import { installGodotIndirectSpecular } from '../godotIndirectSpecular.js';
import { installGodotLightFunction } from '../godotLightFunction.js';
import { bestFitNormalsSlot, reflectionSlot, SSR_UNIFORM, ssrState } from './ssrUniforms.js';
import { GODOT_ENCODE_NORMAL } from './bestFitNormals.js';
import { UNLIT_DEFAULT_ROUGHNESS } from './unshadedRoughness.js';
import { ROUGHNESS_FADE } from './ssrShaders.js';
import { installUnlitVaryings, UNLIT_NORMAL_VARYING } from '../shaderPatch/unlitVaryings.js';

const { reflection, bestFitNormals, state } = SSR_UNIFORM;

/**
 * What every program that writes the prepass reads: the state of the pass, and the encoded normal
 * and roughness it writes. Godot marks a moving instance by writing one minus the stored roughness,
 * which every reader folds back, so the static form stands for both.
 */
const PREPASS_PARS = /* glsl */ `
uniform highp sampler2D ${bestFitNormals};
uniform vec4 ${state};

${GODOT_ENCODE_NORMAL}
vec4 godotNormalRoughness( vec3 normal, float roughness ) {
	return vec4( godotEncodeNormal( normal ) * 0.5 + 0.5, roughness * ( 127.0 / 255.0 ) );
}
`;

/**
 * The fade keeps a reflection whole up to `ROUGHNESS_FADE.start` and none from its end, where the
 * trace draws nothing (`:2204`). The reflection holds Godot's rows, top row first, so the read flips three's
 * bottom-up row.
 */
const SSR_FUNCTIONS = /* glsl */ `
uniform highp sampler2D ${reflection};
${PREPASS_PARS}
float godotSsrRoughnessFade( float roughness ) {
	return smoothstep( 0.0, 1.0, 1.0 - clamp( ( roughness - ${ROUGHNESS_FADE.start} ) / ( ${ROUGHNESS_FADE.end} - ${ROUGHNESS_FADE.start} ), 0.0, 1.0 ) );
}

vec4 godotScreenSpaceReflection( float roughness ) {
	if ( ${state}.y < 0.5 ) return vec4( 0.0 );
	ivec2 pixel = ivec2( gl_FragCoord.xy );
	pixel.y = textureSize( ${reflection}, 0 ).y - 1 - pixel.y;
	return texelFetch( ${reflection}, pixel, 0 ) * godotSsrRoughnessFade( roughness );
}
`;

/**
 * The prepass's output, once Godot's roughness is known. A surface the depth prepass draws from the
 * alpha pass cuts at its prepass threshold.
 */
const NORMAL_ROUGHNESS_OUTPUT = /* glsl */ `if ( ${state}.x > 0.5 ) {
		if ( diffuseColor.a < ${state}.z ) discard;
		gl_FragColor = godotNormalRoughness( normal, material.godotRoughness );
		return;
	}
	`;

const THREE_LIGHTS_BEGIN = '#include <lights_fragment_begin>';

const PREPASS_OUTPUT: TextEdit = {
  three: THREE_LIGHTS_BEGIN,
  godot: `${NORMAL_ROUGHNESS_OUTPUT}${THREE_LIGHTS_BEGIN}`,
};

/**
 * An unshaded surface's output: its interpolated normal, turned to face a double-sided surface's
 * viewer (`DO_SIDE_CHECK`, `scene_forward_clustered.glsl:1263-1267`), and Godot's default roughness,
 * which `unshadedRoughness.ts` replaces with the material's own. `encode24` keeps only the normal's
 * direction, so the normal needs no normalising.
 */
const UNSHADED_NORMAL_ROUGHNESS_OUTPUT = /* glsl */ `
	if ( ${state}.x > 0.5 ) {
		if ( diffuseColor.a < ${state}.z ) discard;
		#ifdef DOUBLE_SIDED
			float godotUnlitFace = gl_FrontFacing ? 1.0 : - 1.0;
		#else
			float godotUnlitFace = 1.0;
		#endif
		${UNLIT_DEFAULT_ROUGHNESS}
		gl_FragColor = godotNormalRoughness( ${UNLIT_NORMAL_VARYING} * godotUnlitFace, godotUnlitRoughness );
		return;
	}`;

const THREE_CLIPPING_PARS_FRAGMENT = '#include <clipping_planes_pars_fragment>';
const THREE_SPECULARMAP_FRAGMENT = '#include <specularmap_fragment>';

/** After the alpha cut and the roughness map's read, before the unlit colour, as the lit output sits. */
const UNSHADED_PREPASS_FRAGMENT: readonly TextEdit[] = [
  {
    three: THREE_CLIPPING_PARS_FRAGMENT,
    godot: `${THREE_CLIPPING_PARS_FRAGMENT}\n${PREPASS_PARS}`,
  },
  {
    three: THREE_SPECULARMAP_FRAGMENT,
    godot: `${THREE_SPECULARMAP_FRAGMENT}${UNSHADED_NORMAL_ROUGHNESS_OUTPUT}`,
  },
];

/** Premultiplied, over the indirect specular, which the base layer's weights then scale (`:2207`). */
const SSR_FOLD = /* glsl */ `
#if defined( STANDARD )

	if ( ${state}.y > 0.5 ) {
		vec4 godotSsr = godotScreenSpaceReflection( material.godotRoughness );
		reflectedLight.indirectSpecular = reflectedLight.indirectSpecular * ( 1.0 - godotSsr.a ) + godotIndirectSpecular( godotSsr.rgb, material );
	}

#endif
`;

/**
 * Writes the prepass's output in every basic and physical program compiled after the call, lays the
 * reflection in every physical one, and gives every built-in material the shared slots it reads. A three release that rewrites the
 * anchor keeps all its chunks, and `ssrSceneChunk.test.ts` fails on that release. A second call
 * changes nothing.
 */
export function installGodotScreenSpaceReflection(): boolean {
  const isPatched = installChunkEdits({
    mark: NORMAL_ROUGHNESS_OUTPUT,
    patch: 'screen-space reflection',
    fragmentShaders: {
      basic: UNSHADED_PREPASS_FRAGMENT,
      standard: [PREPASS_OUTPUT],
      physical: [PREPASS_OUTPUT],
    },
    // After Godot's occlusion of a reflection, which `installGodotIndirectSpecular` appends.
    append: { lights_physical_pars_fragment: SSR_FUNCTIONS, aomap_fragment: SSR_FOLD },
    requires: [installGodotIndirectSpecular, installGodotLightFunction, installUnlitVaryings],
  });
  if (!isPatched) return false;
  installLitUniform(reflection, reflectionSlot);
  // Every material that merges the fog uniforms, the unshaded one among them.
  installMergedUniform(FOG_UNIFORMS_MERGE, bestFitNormals, bestFitNormalsSlot);
  installMergedUniform(FOG_UNIFORMS_MERGE, state, ssrState);
  return true;
}
