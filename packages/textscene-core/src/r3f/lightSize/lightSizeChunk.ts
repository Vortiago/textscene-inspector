/**
 * Each light's size in three's light loops: the loop sets `godotSizeOffset` from the light's slot in
 * `godotLightSizes` before it shades the light, and the light function adds it to N.L, N.H and L.H
 * (`scene_forward_lights_inc.glsl:133`, `:171-176`, `:224`). An omni or spot light's offset grows as
 * the fragment nears it. A directional or sun light's slot holds its offset as is
 * (`scene_forward_clustered.glsl:2617`).
 */

import { applyChunkEdits, installChunkPatch, type ChunkEdit } from '../shaderPatch/chunkPatch.js';
import { installLightSizeUniforms, LIGHT_SIZES } from './lightSize.js';

type LightSizeChunk = 'lights_pars_begin' | 'lights_fragment_begin';

const SHADED_LIGHTS = 'NUM_DIR_LIGHTS + NUM_SUN_LIGHTS + NUM_POINT_LIGHTS + NUM_SPOT_LIGHTS';

/**
 * Every lit program reads lights_pars_begin, so the offset is declared there for the light loops
 * of each. The offset is one minus the cosine of the angle the light's size subtends
 * (`:463-468`, `:769-774`).
 */
const SIZE_DECLARATIONS = /* glsl */ `#if ${SHADED_LIGHTS} > 0
	uniform float ${LIGHT_SIZES}[ ${SHADED_LIGHTS} ];
#endif
float godotSizeOffset = 0.0;
float godotSizeOffsetAt( const in float size, const in float lightDistance ) {
	float t = size / max( 0.001, lightDistance );
	return max( 1.0 - 1.0 / sqrt( 1.0 + t * t ), 0.0 );
}
`;

const THREE_AMBIENT_UNIFORM = 'uniform vec3 ambientLightColor;';

/**
 * The line that picks each sized loop's light, its light, and the offset of that kind's slots in the
 * array. three unrolls `[ i ]` alone, so a slot past the offset reads `UNROLLED_LOOP_INDEX`.
 */
const SIZED_LOOPS = [
  { three: 'pointLight = pointLights[ i ];', light: 'pointLight', offset: 'NUM_DIR_LIGHTS + NUM_SUN_LIGHTS' },
  {
    three: 'spotLight = spotLights[ i ];',
    light: 'spotLight',
    offset: 'NUM_DIR_LIGHTS + NUM_SUN_LIGHTS + NUM_POINT_LIGHTS',
  },
];

/** The line that picks each directional loop's light, and the offset of that kind's slots. */
const DIRECTIONAL_LOOPS = [
  { three: 'directionalLight = directionalLights[ i ];', offset: '' },
  { three: 'sunLight = sunLights[ i ];', offset: 'NUM_DIR_LIGHTS + ' },
];

const LIGHT_SIZE_EDITS: readonly ChunkEdit<LightSizeChunk>[] = [
  {
    chunk: 'lights_pars_begin',
    three: THREE_AMBIENT_UNIFORM,
    godot: `${SIZE_DECLARATIONS}${THREE_AMBIENT_UNIFORM}`,
  },
  ...SIZED_LOOPS.map(({ three, light, offset }) => ({
    chunk: 'lights_fragment_begin' as const,
    three,
    godot: `${three}
		godotSizeOffset = godotSizeOffsetAt( ${LIGHT_SIZES}[ ${offset} + UNROLLED_LOOP_INDEX ], length( ${light}.position - geometryPosition ) );`,
  })),
  ...DIRECTIONAL_LOOPS.map(({ three, offset }) => ({
    chunk: 'lights_fragment_begin' as const,
    three,
    godot: `${three}
		godotSizeOffset = ${LIGHT_SIZES}[ ${offset}UNROLLED_LOOP_INDEX ];`,
  })),
];

/** The text that proves the patch installed, which a patch that reads it requires. */
export const LIGHT_SIZE_MARK = SIZE_DECLARATIONS;

/**
 * Hands each light's size to every program compiled after the call, and gives the array to every
 * built-in lit material. A three release that rewrites a replaced line keeps all its own chunks,
 * and `lightSizeChunk.test.ts` fails on that release. A second call changes nothing.
 */
export function installGodotLightSize(): void {
  const isPatched = installChunkPatch({
    names: ['lights_pars_begin', 'lights_fragment_begin'],
    isApplied: (chunks) => chunks.lights_pars_begin.includes(LIGHT_SIZE_MARK),
    apply: (chunks) => applyChunkEdits(chunks, LIGHT_SIZE_EDITS),
    missing: 'lights_pars_begin or lights_fragment_begin lacks a line the light size patch replaces',
  });
  if (isPatched) installLightSizeUniforms();
}
