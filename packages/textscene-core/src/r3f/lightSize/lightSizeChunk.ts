/**
 * Each light's size in three's light loops: the loop sets `godotSizeOffset` from the light's slot in
 * `godotLightSizes` before it shades the light, and the light function adds it to N.L, N.H and L.H
 * (`scene_forward_lights_inc.glsl:133`, `:171-176`, `:224`). An omni or spot light's offset grows as
 * the fragment nears it. A directional or sun light's slot holds its offset as is
 * (`scene_forward_clustered.glsl:2617`).
 */

import { installChunkEdits, type ChunkEdit } from '../shaderPatch/chunkPatch.js';
import {
  isPositionalKind,
  LIGHT_SLOT_LOOPS,
  LIGHTS_PARS_ANCHOR,
  slotArrayDeclaration,
} from '../lightSlots.js';
import { installLightSizeUniforms, LIGHT_SIZES } from './lightSize.js';

type LightSizeChunk = 'lights_pars_begin' | 'lights_fragment_begin';

/**
 * Every lit program reads lights_pars_begin, so the offset is declared there for the light loops
 * of each. The offset is one minus the cosine of the angle the light's size subtends
 * (`:463-468`, `:769-774`).
 */
const SIZE_DECLARATIONS = /* glsl */ `${slotArrayDeclaration(LIGHT_SIZES)}float godotSizeOffset = 0.0;
float godotSizeOffsetAt( const in float size, const in float lightDistance ) {
	float t = size / max( 0.001, lightDistance );
	return max( 1.0 - 1.0 / sqrt( 1.0 + t * t ), 0.0 );
}
`;

const LIGHT_SIZE_EDITS: readonly ChunkEdit<LightSizeChunk>[] = [
  {
    chunk: 'lights_pars_begin',
    three: LIGHTS_PARS_ANCHOR,
    godot: `${SIZE_DECLARATIONS}${LIGHTS_PARS_ANCHOR}`,
  },
  ...LIGHT_SLOT_LOOPS.map(({ kind, three, light, slot }) => ({
    chunk: 'lights_fragment_begin' as const,
    three,
    // A positional light's offset grows as the fragment nears it.
    godot: isPositionalKind(kind)
      ? `${three}
		godotSizeOffset = godotSizeOffsetAt( ${LIGHT_SIZES}[ ${slot} ], length( ${light}.position - geometryPosition ) );`
      : `${three}
		godotSizeOffset = ${LIGHT_SIZES}[ ${slot} ];`,
  })),
];

/**
 * Hands each light's size to every program compiled after the call, and gives the array to every
 * built-in lit material. A three release that rewrites a replaced line keeps all its own chunks,
 * and `lightSizeChunk.test.ts` fails on that release. True when the chunks hold the patch after the
 * call. A second call changes nothing.
 */
export function installGodotLightSize(): boolean {
  const isPatched = installChunkEdits({
    edits: LIGHT_SIZE_EDITS,
    mark: SIZE_DECLARATIONS,
    patch: 'light size',
  });
  if (isPatched) installLightSizeUniforms();
  return isPatched;
}
