/**
 * The normal-roughness prepass's output in three's programs. The prepass draws each lit surface
 * through its own program, which writes its view normal and its roughness in place of its colour
 * (`scene_forward_clustered.glsl:2912-2920`), and each unshaded one writes its interpolated normal.
 */

import { installChunkEdits, type TextEdit } from '../shaderPatch/chunkPatch.js';
import { FOG_UNIFORMS_MERGE, installMergedUniform } from '../shaderPatch/litUniform.js';
import { installGodotLightFunction } from '../godotLightFunction.js';
import { installUnlitVaryings, UNLIT_NORMAL_VARYING } from '../shaderPatch/unlitVaryings.js';
import { bestFitNormalsSlot, SCREEN_SPACE_UNIFORM, screenSpaceState } from './screenSpaceState.js';
import { GODOT_ENCODE_NORMAL } from './bestFitNormals.js';
import { UNLIT_DEFAULT_ROUGHNESS } from './unshadedRoughness.js';

const { bestFitNormals, state } = SCREEN_SPACE_UNIFORM;

/**
 * What every program that writes the prepass reads: the state of the passes, and the encoded normal
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

/**
 * Writes the prepass's output in every basic and physical program compiled after the call, and
 * gives every built-in material the state and the table it reads. A three release that rewrites the
 * anchor keeps all its chunks, and `prepassChunk.test.ts` fails on that release. A second call
 * changes nothing.
 */
export function installNormalRoughnessPrepass(): boolean {
  const isPatched = installChunkEdits({
    mark: NORMAL_ROUGHNESS_OUTPUT,
    patch: 'normal-roughness prepass',
    fragmentShaders: {
      basic: UNSHADED_PREPASS_FRAGMENT,
      standard: [PREPASS_OUTPUT],
      physical: [PREPASS_OUTPUT],
    },
    append: { lights_physical_pars_fragment: PREPASS_PARS },
    // The roughness Godot's lights read, and the unshaded normal.
    requires: [installGodotLightFunction, installUnlitVaryings],
  });
  if (!isPatched) return false;
  // Every material that merges the fog uniforms, the unshaded one among them.
  installMergedUniform(FOG_UNIFORMS_MERGE, bestFitNormals, bestFitNormalsSlot);
  installMergedUniform(FOG_UNIFORMS_MERGE, state, screenSpaceState);
  return true;
}
