/**
 * What the blocker search of a directional light with an angular distance reads, beyond three's sun
 * shadow: the direction towards the light and the angle, and each slot's range start, one vec4 each
 * per sun shadow (`splitShadowChunk.ts`). Each slot's box size in the atlas is its matrix's scale.
 * Godot turns the search on for every directional light of a render once one light needs it
 * (`light_storage.cpp:680-686`, `scene_forward_clustered.glsl:2310`). The scene's light pass
 * (`SceneShadowFitter.tsx`) writes both arrays before each render.
 */

import * as THREE from 'three';
import type { SceneLight } from './lightLists.js';
import { readDirectionalShadowDeclaration, type DirectionalShadowDeclaration } from './declaration.js';
import { SPLIT_SLOTS } from './splitShadow.js';
import { declaredLightOf, isSplitSun } from './splitSun.js';
import { slottedLights } from '../lightSlots.js';
import { LightUniformArrays } from '../shaderPatch/lightUniformArrays.js';

export const SUN_SOFT_SHADOWS = 'godotSunSoftShadows';
export const SUN_RANGE_BEGINS = 'godotSunRangeBegins';

/** One vec4: the direction towards the light, and the angle. */
const SOFT_SHADOW_FLOATS = 4;

/** Two vec4s per sun shadow. Written only by `writeSunSoftShadowUniforms`. */
const arrays = new LightUniformArrays({
  [SUN_SOFT_SHADOWS]: SOFT_SHADOW_FLOATS,
  [SUN_RANGE_BEGINS]: SPLIT_SLOTS,
});

/** Scratch for the writer, which runs on every render. */
const scratchDirection = new THREE.Vector3();

/** Gives the arrays to every built-in lit material. */
export function installSunSoftShadowUniforms(): void {
  arrays.install();
}

/** The declaration of the light a slotted directional light or sun shades for. */
function declarationOf(light: THREE.Light): DirectionalShadowDeclaration | null {
  const declared = declaredLightOf(light);
  return declared ? readDirectionalShadowDeclaration(declared) : null;
}

/**
 * Whether any directional light among `lights` turns Godot's directional soft shadows on, drawn or
 * not, so every lit program compiles the search (`../shadowFilter/softShadowSearch.ts`). The camera
 * plays no part, so two cameras of one scene compile one program.
 */
export function searchesDirectionalBlockers(lights: readonly SceneLight[]): boolean {
  return lights.some(({ light }) => declarationOf(light)?.drawsSoftShadow === true);
}

/** Whether any directional light drawn through `camera` turns Godot's directional soft shadows on. */
export function drawsDirectionalSoftShadows(lights: readonly SceneLight[], camera: THREE.Camera): boolean {
  const { directional, sun } = slottedLights(lights, camera);
  const drawsSoftShadow = (light: THREE.Light) => declarationOf(light)?.drawsSoftShadow === true;
  return directional.some(drawsSoftShadow) || sun.some(drawsSoftShadow);
}

/**
 * Writes each sun shadow's terms, in three's order of its sun shadows: every split sun casts, and
 * three sorts casting lights first. A sun gets no angle while `drawsSoftShadows` is off, so its
 * lookup takes the PCF.
 */
export function writeSunSoftShadowUniforms(
  lights: readonly SceneLight[],
  camera: THREE.Camera,
  drawsSoftShadows: boolean
): void {
  const suns = slottedLights(lights, camera).sun.filter(isSplitSun);
  arrays.write(suns.length, (set) => {
    suns.forEach((sun, index) => {
      const angle = drawsSoftShadows ? (declarationOf(sun)?.softShadowAngle ?? 0) : 0;
      // The fitter places the sun at the light's offset from its target (`followDeclaredLight`).
      const offset = index * SOFT_SHADOW_FLOATS;
      scratchDirection
        .setFromMatrixPosition(sun.matrixWorld)
        .normalize()
        .toArray(set[SUN_SOFT_SHADOWS], offset);
      set[SUN_SOFT_SHADOWS][offset + 3] = angle;
      sun.shadow.rangeBegins.toArray(set[SUN_RANGE_BEGINS], index * SPLIT_SLOTS);
    });
  });
}
