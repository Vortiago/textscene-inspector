/**
 * The static-light skip in three's light loops: in a lightmapped program, each loop darkens a light
 * whose slot in `godotLightStatics` or `godotAreaLightStatics` flags it Static, before it shades
 * the light, while the surface's lightmap draws (`scene_forward_clustered.glsl:2292`, `:2685`,
 * `:2746`). A dark light shades nothing, as the skipped one does.
 */

import { applyChunkEdits, installChunkPatch, type ChunkEdit } from '../shaderPatch/chunkPatch.js';
import { LIGHT_SLOT_LOOPS, LIGHTS_PARS_ANCHOR, slotArrayDeclaration } from '../lightSlots.js';
import { AREA_LIGHT_STATICS, installLightBakeModeUniforms, LIGHT_STATICS } from './lightBakeMode.js';

type LightBakeModeChunk = 'lights_pars_begin' | 'lights_fragment_begin';

const STATIC_DECLARATIONS = /* glsl */ `#ifdef GODOT_LIGHTMAP
${slotArrayDeclaration(LIGHT_STATICS)}#if NUM_RECT_AREA_LIGHTS > 0
	uniform float ${AREA_LIGHT_STATICS}[ NUM_RECT_AREA_LIGHTS ];
#endif
#endif
`;

const THREE_AREA_LIGHT = 'rectAreaLight = rectAreaLights[ i ];';

/** The line after `three` that darkens `light` when its flag in `array` at `slot` is set. */
function staticSkip(three: string, light: string, array: string, slot: string): string {
  return `${three}
		#ifdef GODOT_LIGHTMAP
		if ( godotLightmapActive && ${array}[ ${slot} ] > 0.5 ) ${light}.color = vec3( 0.0 );
		#endif`;
}

const LIGHT_BAKE_MODE_EDITS: readonly ChunkEdit<LightBakeModeChunk>[] = [
  {
    chunk: 'lights_pars_begin',
    three: LIGHTS_PARS_ANCHOR,
    godot: `${STATIC_DECLARATIONS}${LIGHTS_PARS_ANCHOR}`,
  },
  ...LIGHT_SLOT_LOOPS.map(({ three, light, slot }) => ({
    chunk: 'lights_fragment_begin' as const,
    three,
    godot: staticSkip(three, light, LIGHT_STATICS, slot),
  })),
  {
    chunk: 'lights_fragment_begin',
    three: THREE_AREA_LIGHT,
    godot: staticSkip(THREE_AREA_LIGHT, 'rectAreaLight', AREA_LIGHT_STATICS, 'UNROLLED_LOOP_INDEX'),
  },
];

/**
 * Hands each light's bake mode to every program compiled after the call, and gives the arrays to
 * every built-in lit material. A three release that rewrites a replaced line keeps all its own
 * chunks, and `lightBakeModeChunk.test.ts` fails on that release. A second call changes nothing.
 */
export function installGodotLightBakeMode(): void {
  const isPatched = installChunkPatch({
    names: ['lights_pars_begin', 'lights_fragment_begin'],
    isApplied: (chunks) => chunks.lights_pars_begin.includes(STATIC_DECLARATIONS),
    apply: (chunks) => applyChunkEdits(chunks, LIGHT_BAKE_MODE_EDITS),
    missing: 'lights_pars_begin or lights_fragment_begin lacks a line the light bake mode patch replaces',
  });
  if (isPatched) installLightBakeModeUniforms();
}
