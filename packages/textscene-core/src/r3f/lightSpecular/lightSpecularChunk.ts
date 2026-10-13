/**
 * Each omni, spot and directional light's `specular_amount` in three's light loops: the loop sets
 * `godotSpecularAmount` from the light's slot in `godotLightSpeculars` before it shades the light,
 * and the light function scales the light's specular by it (`scene_forward_lights_inc.glsl:185`,
 * `:234`, `:263`).
 */

import { applyChunkEdits, installChunkPatch, type ChunkEdit } from '../shaderPatch/chunkPatch.js';
import { installLightSpecularUniforms, LIGHT_SPECULARS } from './lightSpecular.js';

type LightSpecularChunk = 'lights_pars_begin' | 'lights_fragment_begin';

const SHADED_LIGHTS = 'NUM_DIR_LIGHTS + NUM_SUN_LIGHTS + NUM_POINT_LIGHTS + NUM_SPOT_LIGHTS';

/**
 * Every lit program reads lights_pars_begin, so the amount is declared there for the light loops of
 * each. A light the loops never set, such as a hemisphere light, keeps the full specular.
 */
const SPECULAR_DECLARATIONS = /* glsl */ `#if ${SHADED_LIGHTS} > 0
	uniform float ${LIGHT_SPECULARS}[ ${SHADED_LIGHTS} ];
#endif
float godotSpecularAmount = 1.0;
`;

const THREE_AMBIENT_UNIFORM = 'uniform vec3 ambientLightColor;';

/**
 * The line that picks each loop's light, and the offset of that kind's slots in the array. three
 * unrolls `[ i ]` alone, so a slot past the offset reads `UNROLLED_LOOP_INDEX`.
 */
const LOOPS = [
  { three: 'directionalLight = directionalLights[ i ];', offset: '0' },
  { three: 'sunLight = sunLights[ i ];', offset: 'NUM_DIR_LIGHTS' },
  { three: 'pointLight = pointLights[ i ];', offset: 'NUM_DIR_LIGHTS + NUM_SUN_LIGHTS' },
  { three: 'spotLight = spotLights[ i ];', offset: 'NUM_DIR_LIGHTS + NUM_SUN_LIGHTS + NUM_POINT_LIGHTS' },
];

const LIGHT_SPECULAR_EDITS: readonly ChunkEdit<LightSpecularChunk>[] = [
  {
    chunk: 'lights_pars_begin',
    three: THREE_AMBIENT_UNIFORM,
    godot: `${SPECULAR_DECLARATIONS}${THREE_AMBIENT_UNIFORM}`,
  },
  ...LOOPS.map(({ three, offset }) => ({
    chunk: 'lights_fragment_begin' as const,
    three,
    godot: `${three}
		godotSpecularAmount = ${LIGHT_SPECULARS}[ ${offset} + UNROLLED_LOOP_INDEX ];`,
  })),
];

/** The text that proves the patch installed, which a patch that reads it requires. */
export const LIGHT_SPECULAR_MARK = SPECULAR_DECLARATIONS;

/**
 * Hands each light's specular amount to every program compiled after the call, and gives the
 * array to every built-in lit material. A three release that rewrites a replaced line keeps all
 * its own chunks, and `lightSpecularChunk.test.ts` fails on that release. A second call changes
 * nothing.
 */
export function installGodotLightSpecular(): void {
  const isPatched = installChunkPatch({
    names: ['lights_pars_begin', 'lights_fragment_begin'],
    isApplied: (chunks) => chunks.lights_pars_begin.includes(LIGHT_SPECULAR_MARK),
    apply: (chunks) => applyChunkEdits(chunks, LIGHT_SPECULAR_EDITS),
    missing: 'lights_pars_begin or lights_fragment_begin lacks a line the light specular patch replaces',
  });
  if (isPatched) installLightSpecularUniforms();
}
