/**
 * Each omni, spot and directional light's `specular_amount` in three's light loops: the loop sets
 * `godotSpecularAmount` from the light's slot in `godotLightSpeculars` before it shades the light,
 * and the light function scales the light's specular by it (`scene_forward_lights_inc.glsl:185`,
 * `:234`, `:263`).
 */

import { installChunkEdits, type ChunkEdit } from '../shaderPatch/chunkPatch.js';
import { LIGHT_SLOT_LOOPS, LIGHTS_PARS_ANCHOR, slotArrayDeclaration } from '../lightSlots.js';
import { installLightSpecularUniforms, LIGHT_SPECULARS } from './lightSpecular.js';

type LightSpecularChunk = 'lights_pars_begin' | 'lights_fragment_begin';

/**
 * Every lit program reads lights_pars_begin, so the amount is declared there for the light loops of
 * each. A light the loops never set, such as a hemisphere light, keeps the full specular.
 */
const SPECULAR_DECLARATIONS = /* glsl */ `${slotArrayDeclaration(LIGHT_SPECULARS)}float godotSpecularAmount = 1.0;
`;

const LIGHT_SPECULAR_EDITS: readonly ChunkEdit<LightSpecularChunk>[] = [
  {
    chunk: 'lights_pars_begin',
    three: LIGHTS_PARS_ANCHOR,
    godot: `${SPECULAR_DECLARATIONS}${LIGHTS_PARS_ANCHOR}`,
  },
  ...LIGHT_SLOT_LOOPS.map(({ three, slot }) => ({
    chunk: 'lights_fragment_begin' as const,
    three,
    godot: `${three}
		godotSpecularAmount = ${LIGHT_SPECULARS}[ ${slot} ];`,
  })),
];

/**
 * Hands each light's specular amount to every program compiled after the call, and gives the
 * array to every built-in lit material. A three release that rewrites a replaced line keeps all
 * its own chunks, and `lightSpecularChunk.test.ts` fails on that release. True when the chunks hold
 * the patch after the call. A second call changes nothing.
 */
export function installGodotLightSpecular(): boolean {
  const isPatched = installChunkEdits({
    edits: LIGHT_SPECULAR_EDITS,
    mark: SPECULAR_DECLARATIONS,
    patch: 'light specular',
  });
  if (isPatched) installLightSpecularUniforms();
  return isPatched;
}
