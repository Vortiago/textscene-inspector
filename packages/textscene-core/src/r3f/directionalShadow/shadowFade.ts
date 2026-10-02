/**
 * Godot's directional shadow fade in three's lighting chunks. Godot mixes a directional shadow
 * towards unshadowed across the far end of its last split and draws none past it
 * (`scene_forward_clustered.glsl:2491`). three shadows every receiver inside the shadow camera's
 * box, and the fitted box reaches past that end.
 */

import type { DirectionalShadowFade } from '../../godot/directionalShadow.js';
import { installChunkPatch, type Chunks } from '../shaderPatch/chunkPatch.js';
import { installLitUniform, installedUniformValue } from '../shaderPatch/litUniform.js';

/** The uniform every lit material reads its fades from. */
export const DIRECTIONAL_SHADOW_FADE_UNIFORM = 'directionalShadowFade';

/**
 * The fades the buffer holds. The sun shadows are at most Godot's eight shadowed lights. An
 * undeclared directional light binds a sampler of its own, so texture units bound those, and a
 * desktop GPU commonly reports 32 (`MAX_TEXTURE_IMAGE_UNITS`).
 */
const MAX_FADED_SHADOWS = 32;

const installedFades = installedUniformValue(DIRECTIONAL_SHADOW_FADE_UNIFORM);

/**
 * `[from, to]` per shadow: every directional shadow, then every sun shadow, each in three's order.
 * Written only by `writeDirectionalShadowFades`, before each render. A typed array, not an `Array`:
 * `cloneUniforms` copies an `Array` per material and keeps any other value by reference (three
 * r186 `UniformsUtils.js:43-65`). So every material reads this one buffer. After a dev server
 * reloads this module, it is the buffer the earlier evaluation installed, which every compiled
 * program reads.
 */
const fades =
  installedFades instanceof Float32Array ? installedFades : new Float32Array(MAX_FADED_SHADOWS * 2);

/**
 * The fade goes in ahead of three's own shadow declarations, outside both the directional and
 * the sun block, so it is declared once whichever of the two a program compiles.
 * `splitShadowChunk.ts` rewrites the sun block only, and `softShadowFilter.ts` goes in after the
 * fade, ahead of that block, so the patches compose in any order.
 */
const PARS_ANCHOR = '#ifdef USE_SHADOWMAP\n';

/**
 * A fade whose ends do not ascend is no fade. That covers the zeros of a light nothing fitted and
 * of a material that lacks the uniform, and keeps `smoothstep` defined.
 */
const PARS_FADE = `${PARS_ANCHOR}
	#if NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0
		uniform vec2 ${DIRECTIONAL_SHADOW_FADE_UNIFORM}[ NUM_DIR_LIGHT_SHADOWS + NUM_SUN_LIGHT_SHADOWS ];
		float directionalShadowFadeOut( const in vec2 fade, const in float depth ) {
			return fade.y > fade.x ? smoothstep( fade.x, fade.y, depth ) : 0.0;
		}
	#endif
`;

const DIRECTIONAL_SHADOW =
  'getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] )';

/** The sun shadow lookup, with three's per-shadow sampler or the atlas of `shadowAtlasChunk.ts`. */
const SUN_SHADOW = /getSunShadow\( [^,]+, sunLightShadow, UNROLLED_LOOP_INDEX \)/;

/**
 * `geometryPosition` is the view-space position, so its negated z is Godot's `-vertex.z`. The
 * index is `[ i ]` or spelt with `UNROLLED_LOOP_INDEX`: three's unroll rewrites only those two
 * (r186 `WebGLProgram.js:290-304`), and no loop variable survives it.
 */
function fadedShadow(shadow: string, fadeIndex: string): string {
  return `mix( ${shadow}, 1.0, directionalShadowFadeOut( ${DIRECTIONAL_SHADOW_FADE_UNIFORM}[ ${fadeIndex} ], - geometryPosition.z ) )`;
}

export type ShadowFadeChunks = Chunks<'shadowmap_pars_fragment' | 'lights_fragment_begin'>;

/** Both chunks with the fade in, or null when either lacks a line the fade hooks onto. */
export function shadowFadeChunks(chunks: ShadowFadeChunks): ShadowFadeChunks | null {
  const { shadowmap_pars_fragment: pars, lights_fragment_begin: lights } = chunks;
  if (!pars.includes(PARS_ANCHOR) || !lights.includes(DIRECTIONAL_SHADOW) || !SUN_SHADOW.test(lights)) {
    return null;
  }
  return {
    shadowmap_pars_fragment: pars.replace(PARS_ANCHOR, PARS_FADE),
    lights_fragment_begin: lights
      .replace(DIRECTIONAL_SHADOW, fadedShadow(DIRECTIONAL_SHADOW, 'i'))
      .replace(SUN_SHADOW, (sunShadow) =>
        fadedShadow(sunShadow, 'NUM_DIR_LIGHT_SHADOWS + UNROLLED_LOOP_INDEX')
      ),
  };
}

/**
 * Patches three's chunks and gives every built-in lit material and `UniformsLib.lights` the fade
 * uniform, for every program compiled after the call. A three release that rewrites any hooked line
 * keeps its own chunks, and `shadowFade.test.ts` fails on that release. A second call leaves the
 * chunks as they are.
 */
export function installDirectionalShadowFade(): void {
  const isPatched = installChunkPatch({
    names: ['shadowmap_pars_fragment', 'lights_fragment_begin'],
    isApplied: (chunks) => chunks.shadowmap_pars_fragment.includes(DIRECTIONAL_SHADOW_FADE_UNIFORM),
    apply: shadowFadeChunks,
    missing: 'shadowmap_pars_fragment or lights_fragment_begin has no directional shadow line to fade',
  });
  if (isPatched) installLitUniform(DIRECTIONAL_SHADOW_FADE_UNIFORM, fades);
}

/**
 * The fade of each shadow a render draws, by three's shadow index. three counts directional
 * shadows and sun shadows separately (r186 `WebGLLights.js:289-356`), and the shader reads a sun
 * shadow's fade after every directional one. Null is no fade.
 */
export interface ShadowFades {
  directional: readonly (DirectionalShadowFade | null)[];
  sun: readonly (DirectionalShadowFade | null)[];
}

/** Sets the buffer from `shadowFades`. Every entry past the lists fades nothing. */
export function writeDirectionalShadowFades(shadowFades: ShadowFades): void {
  fades.fill(0);
  const { directional, sun } = shadowFades;
  for (let index = 0; index < directional.length; index++) writeFade(index, directional[index] ?? null);
  for (let index = 0; index < sun.length; index++) writeFade(directional.length + index, sun[index] ?? null);
}

/** Writes one shadow's fade at its index. A shadow past the buffer has no entry, and fades nothing. */
function writeFade(index: number, fade: DirectionalShadowFade | null): void {
  if (!fade || index * 2 >= fades.length) return;
  fades[index * 2] = fade.from;
  fades[index * 2 + 1] = fade.to;
}
