/**
 * Godot's directional shadow fade in three's lighting chunks. Godot mixes a directional shadow
 * towards unshadowed across the far end of its last split and draws none past it
 * (`scene_forward_clustered.glsl:2491`). three shadows every receiver inside the shadow camera's
 * box, and the fitted box reaches past that end.
 */

import * as THREE from 'three';
import { MAX_DIRECTIONAL_LIGHTS, type DirectionalShadowFade } from '../../godot/directionalShadow.js';
import { warn } from '../../logger';

/** The uniform every lit material reads its fades from. */
export const DIRECTIONAL_SHADOW_FADE_UNIFORM = 'directionalShadowFade';

/**
 * `[from, to]` per shadow: first every directional shadow in three's directional shadow order,
 * then every sun shadow in three's sun shadow order. Written only by
 * `writeDirectionalShadowFades`, before each render. A typed array, not an `Array`:
 * `cloneUniforms` copies an `Array` per material and keeps any other value by reference
 * (three r186 `UniformsUtils.js:43-65`), so every material reads this one buffer.
 */
const fades = new Float32Array(MAX_DIRECTIONAL_LIGHTS * 2);

const PARS_CHUNK = 'shadowmap_pars_fragment';
const LIGHTS_CHUNK = 'lights_fragment_begin';

/**
 * The fade goes in ahead of three's own shadow declarations, outside both the directional and
 * the sun block, so it is declared once whichever of the two a program compiles.
 * `splitShadowChunk.ts` rewrites the sun block only, so the two patches compose in either order.
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

const SUN_SHADOW = 'getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX )';

/**
 * `geometryPosition` is the view-space position, so its negated z is Godot's `-vertex.z`. The
 * index is `[ i ]` or spelt with `UNROLLED_LOOP_INDEX`: three's unroll rewrites only those two
 * (r186 `WebGLProgram.js:290-304`), and no loop variable survives it.
 */
function fadedShadow(shadow: string, fadeIndex: string): string {
  return `mix( ${shadow}, 1.0, directionalShadowFadeOut( ${DIRECTIONAL_SHADOW_FADE_UNIFORM}[ ${fadeIndex} ], - geometryPosition.z ) )`;
}

export interface ShadowFadeChunks {
  pars: string;
  lights: string;
}

/** Both chunks with the fade in, or null when either lacks a line the fade hooks onto. */
export function shadowFadeChunks(pars: string, lights: string): ShadowFadeChunks | null {
  if (!pars.includes(PARS_ANCHOR) || !lights.includes(DIRECTIONAL_SHADOW) || !lights.includes(SUN_SHADOW)) {
    return null;
  }
  return {
    pars: pars.replace(PARS_ANCHOR, PARS_FADE),
    lights: lights
      .replace(DIRECTIONAL_SHADOW, fadedShadow(DIRECTIONAL_SHADOW, 'i'))
      .replace(SUN_SHADOW, fadedShadow(SUN_SHADOW, 'NUM_DIR_LIGHT_SHADOWS + UNROLLED_LOOP_INDEX')),
  };
}

/**
 * Patches three's chunks and gives every built-in lit material the fade uniform, for every
 * program compiled after the call. A three release that rewrites any hooked line keeps its own
 * chunks, and `shadowFade.test.ts` fails on that release. A second call changes nothing.
 */
export function installDirectionalShadowFade(): void {
  if (THREE.ShaderChunk[PARS_CHUNK].includes(DIRECTIONAL_SHADOW_FADE_UNIFORM)) return;
  const patched = shadowFadeChunks(THREE.ShaderChunk[PARS_CHUNK], THREE.ShaderChunk[LIGHTS_CHUNK]);
  if (patched === null) {
    warn(`[Shading] three's ${PARS_CHUNK} or ${LIGHTS_CHUNK} has no directional shadow line to fade`);
    return;
  }
  THREE.ShaderChunk[PARS_CHUNK] = patched.pars;
  THREE.ShaderChunk[LIGHTS_CHUNK] = patched.lights;
  for (const shader of Object.values(THREE.ShaderLib)) {
    if (shader.fragmentShader.includes(`#include <${LIGHTS_CHUNK}>`)) {
      shader.uniforms[DIRECTIONAL_SHADOW_FADE_UNIFORM] = { value: fades };
    }
  }
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

/**
 * Sets the buffer from `shadowFades`. Every entry past the lists fades nothing. Godot draws at
 * most `MAX_DIRECTIONAL_LIGHTS`, so a shadow past that keeps three's unfaded shadow.
 */
export function writeDirectionalShadowFades(shadowFades: ShadowFades): void {
  fades.fill(0);
  [...shadowFades.directional, ...shadowFades.sun]
    .slice(0, MAX_DIRECTIONAL_LIGHTS)
    .forEach((fade, index) => {
      if (fade) fades.set([fade.from, fade.to], index * 2);
    });
}
