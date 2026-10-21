/**
 * Each area light's shadow terms, in uniform arrays that every lit program reads by the light's
 * index, as Godot's light buffer holds them (4.7.2 `light_storage.cpp:1150-1210`): the matrix into
 * the light's space, the slot, the opacity and biases, and the soft shadow's radius (`softShadowRadius.ts`). `areaLightFalloff.ts`
 * writes them in three's slot order, with the rest of the light's terms.
 */

import * as THREE from 'three';
import { isAreaShadowLight } from '../positionalShadow/atlasAreaShadow.js';
import { LightUniformArrays, type LightArrays } from '../shaderPatch/lightUniformArrays.js';
import { writeVec4 } from '../writeVec4.js';

export const AREA_LIGHT_SHADOW_MATRICES = 'rectAreaLightShadowMatrices';
export const AREA_LIGHT_SHADOW_RECTS = 'rectAreaLightShadowRects';
export const AREA_LIGHT_SHADOWS = 'rectAreaLightShadows';
export const AREA_LIGHT_SOFT_SHADOW_RADII = 'rectAreaLightSoftShadowRadii';
type AreaLightShadowUniform =
  | typeof AREA_LIGHT_SHADOW_MATRICES
  | typeof AREA_LIGHT_SHADOW_RECTS
  | typeof AREA_LIGHT_SHADOWS
  | typeof AREA_LIGHT_SOFT_SHADOW_RADII;

/** Written only by `writeAreaLightShadowUniforms`. */
const arrays = new LightUniformArrays({
  [AREA_LIGHT_SHADOW_MATRICES]: 16,
  [AREA_LIGHT_SHADOW_RECTS]: 4,
  [AREA_LIGHT_SHADOWS]: 4,
  [AREA_LIGHT_SOFT_SHADOW_RADII]: 1,
});

/** Gives the arrays to every built-in lit material. */
export function installAreaLightShadowUniforms(): void {
  arrays.install();
}

const scratchMatrix = new THREE.Matrix4();
const scratchRect = new THREE.Vector4();

/**
 * The light's terms at `index`. A light that casts nothing gets no opacity, so the lookup reads it
 * as lit (`scene_forward_lights_inc.glsl:1009`).
 */
function writeLight(
  set: LightArrays<AreaLightShadowUniform>,
  index: number,
  light: THREE.RectAreaLight,
  camera: THREE.Camera
): void {
  const terms = set[AREA_LIGHT_SHADOWS];
  if (!light.castShadow || !isAreaShadowLight(light)) {
    terms[index * 4] = 0;
    return;
  }
  const { shadow } = light;
  shadow.viewToLookup(camera, scratchMatrix, light).toArray(set[AREA_LIGHT_SHADOW_MATRICES], index * 16);
  (shadow.slotRect(scratchRect) ?? scratchRect.set(0, 0, 0, 0)).toArray(
    set[AREA_LIGHT_SHADOW_RECTS],
    index * 4
  );
  writeVec4(terms, index, shadow.intensity, shadow.normalBias, shadow.bias, shadow.depthScale());
  set[AREA_LIGHT_SOFT_SHADOW_RADII][index] = shadow.radius;
}

/** Writes `slotted`, the rect area lights in three's slot order, for a render through `camera`. */
export function writeAreaLightShadowUniforms(
  slotted: readonly THREE.RectAreaLight[],
  camera: THREE.Camera
): void {
  arrays.write(slotted.length, (set) =>
    slotted.forEach((light, index) => writeLight(set, index, light, camera))
  );
}
