/**
 * The roughness an unshaded StandardMaterial3D writes in the normal-roughness prepass. Godot's
 * unshaded material still sets `ROUGHNESS = roughness_tex * roughness` (`material.cpp:1725`), and
 * the prepass writes it (`scene_forward_clustered.glsl:2913`). The roughness map binds to three's
 * `specularMap`, which the unlit program samples and reads only with an environment map.
 */

import type { ProgramInjection } from '../materialProgramInputs';
import { recordedUniform } from '../materials/recordedOnMaterial';
import { roughnessChannelUniform } from '../materials/godotMetallicRoughnessChannels';
import { editedProgram } from '../shaderPatch/chunkPatch';

/** The uniforms the injection reads. The channel is the lit programs' own. */
const UNSHADED_ROUGHNESS_UNIFORM = {
  roughness: 'godotUnshadedRoughness',
  channel: 'godotRoughnessTextureChannel',
} as const;

/** The `userData` key the roughness is recorded under. */
const ROUGHNESS_KEY = UNSHADED_ROUGHNESS_UNIFORM.roughness;

/** Godot's default `roughness` (`material.cpp:3942`), which the prepass writes without the injection. */
export const DEFAULT_ROUGHNESS = 1;

/** The line of the prepass's unlit output (`prepassChunk.ts`) that the injection replaces. */
export const UNLIT_DEFAULT_ROUGHNESS = 'float godotUnlitRoughness = 1.0;';

const UNLIT_ROUGHNESS = /* glsl */ `float godotUnlitRoughness = ${UNSHADED_ROUGHNESS_UNIFORM.roughness};
		#ifdef USE_SPECULARMAP
			godotUnlitRoughness *= dot( texelSpecular, ${UNSHADED_ROUGHNESS_UNIFORM.channel} );
		#endif`;

const THREE_MAIN = 'void main() {';

const UNIFORMS = `uniform float ${UNSHADED_ROUGHNESS_UNIFORM.roughness};
uniform vec4 ${UNSHADED_ROUGHNESS_UNIFORM.channel};
${THREE_MAIN}`;

/** The `userData` that gives an unshaded material its roughness. */
export function unshadedRoughnessUserData(roughness: number): Record<string, unknown> {
  return { [ROUGHNESS_KEY]: roughness };
}

/** What an unshaded material compiles with when its roughness or roughness map is not the default. */
export const UNSHADED_ROUGHNESS: ProgramInjection = {
  cacheKey: 'godot-unshaded-roughness',
  onBeforeCompile(shader) {
    Object.assign(shader.uniforms, {
      [UNSHADED_ROUGHNESS_UNIFORM.roughness]: recordedUniform(this, ROUGHNESS_KEY, DEFAULT_ROUGHNESS),
      [UNSHADED_ROUGHNESS_UNIFORM.channel]: roughnessChannelUniform(this),
    });
    editedProgram(
      shader,
      {
        fragment: [
          { three: THREE_MAIN, godot: UNIFORMS },
          { three: UNLIT_DEFAULT_ROUGHNESS, godot: UNLIT_ROUGHNESS },
        ],
      },
      'unshaded roughness'
    );
  },
};
