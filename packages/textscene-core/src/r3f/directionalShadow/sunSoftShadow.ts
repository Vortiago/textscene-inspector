/**
 * Godot's directional soft shadows: whether a render compiles and draws the blocker search, and each
 * sun shadow's angle for it. Godot turns the search on for every directional light of a render once
 * one light needs it (`light_storage.cpp:680-686`, `scene_forward_clustered.glsl:2310`). The scene's
 * light pass (`SceneShadowFitter.tsx`) sets the angles before each render.
 */

import type * as THREE from 'three';
import type { SceneLight } from './lightLists.js';
import { readDirectionalShadowDeclaration, type DirectionalShadowDeclaration } from './declaration.js';
import { declaredLightOf, isSplitSun } from './splitSun.js';
import { slottedLights } from '../lightSlots.js';

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
 * Sets the soft shadow angle of each split sun among `lights`, and 0 on all of them while
 * `drawsSoftShadows` is off.
 */
export function setSunSoftShadowAngles(lights: readonly SceneLight[], drawsSoftShadows: boolean): void {
  for (const { light } of lights) {
    if (!isSplitSun(light)) continue;
    light.shadow.softShadowAngle = drawsSoftShadows ? (declarationOf(light)?.softShadowAngle ?? 0) : 0;
  }
}
