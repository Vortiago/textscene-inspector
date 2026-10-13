/**
 * Each area light's Godot terms that three's `RectAreaLight` struct lacks, in two uniform arrays
 * that every lit program reads by the light's index: the view-space direction the light shines in,
 * and its range, attenuation and specular amount. The scene's light pass
 * (`SceneShadowFitter.tsx`) writes them before each render, in the order three gives its rect area
 * lights their slots.
 */

import * as THREE from 'three';
import type { SceneLight } from '../directionalShadow/lightLists.js';
import { LightUniformArrays, type LightArrays } from '../shaderPatch/lightUniformArrays.js';

export const AREA_LIGHT_FACINGS = 'rectAreaLightFacings';
export const AREA_LIGHT_FALLOFFS = 'rectAreaLightFalloffs';
type AreaLightUniform = typeof AREA_LIGHT_FACINGS | typeof AREA_LIGHT_FALLOFFS;

/** An AreaLight3D's `area_range`, `area_attenuation` and `light_specular`. */
export interface AreaLightFalloff {
  range: number;
  attenuation: number;
  specular: number;
}

const FALLOFF_KEY = 'godotAreaLightFalloff';

/** The `userData` through which a `RectAreaLight` carries its falloff to the writer. */
export function areaLightUserData(falloff: AreaLightFalloff): Record<string, unknown> {
  return { [FALLOFF_KEY]: falloff };
}

function readFalloff(light: THREE.RectAreaLight): AreaLightFalloff | undefined {
  return light.userData[FALLOFF_KEY] as AreaLightFalloff | undefined;
}

/**
 * Three floats per light in each array. Written only by `writeAreaLightUniforms`.
 */
const arrays = new LightUniformArrays({ [AREA_LIGHT_FACINGS]: 3, [AREA_LIGHT_FALLOFFS]: 3 });

/** Gives the arrays to every built-in lit material. */
export function installAreaLightUniforms(): void {
  arrays.install();
}

/**
 * The rect area lights three gives a slot when it renders through `camera`: visible, on a layer the
 * camera sees, in tree order (r186 `WebGLRenderer.js:1860-1882`). three's sort moves only shadowed
 * and textured lights, and a rect area light is neither (`WebGLLights.js:153-157`, `:245`).
 */
function slottedAreaLights(lights: readonly SceneLight[], camera: THREE.Camera): THREE.RectAreaLight[] {
  const slotted: THREE.RectAreaLight[] = [];
  for (const { light, isVisible } of lights) {
    if (isVisible && isRectAreaLight(light) && light.layers.test(camera.layers)) slotted.push(light);
  }
  return slotted;
}

function isRectAreaLight(light: THREE.Light): light is THREE.RectAreaLight {
  return (light as THREE.RectAreaLight).isRectAreaLight === true;
}

const scratchFacing = new THREE.Vector3();

/**
 * Godot's direction (4.7.2: `light_storage.cpp:1068`), the radius it inverts into `inv_radius`
 * (`:1060-1061`) and its `specular_amount` (`:1056`), at `index` of `set`. The direction needs no
 * falloff, so a light without one still faces its own way.
 */
function writeLight(
  set: LightArrays<AreaLightUniform>,
  index: number,
  light: THREE.RectAreaLight,
  camera: THREE.Camera
) {
  const offset = index * 3;
  scratchFacing
    .set(0, 0, -1)
    .transformDirection(light.matrixWorld)
    .transformDirection(camera.matrixWorldInverse)
    .toArray(set[AREA_LIGHT_FACINGS], offset);
  const falloff = readFalloff(light);
  if (!falloff) return;
  const falloffs = set[AREA_LIGHT_FALLOFFS];
  falloffs[offset] = Math.max(0.001, falloff.range);
  falloffs[offset + 1] = falloff.attenuation;
  falloffs[offset + 2] = falloff.specular * 2;
}

/**
 * Writes the slotted lights among `lights`, for a render through `camera`. A light without a
 * falloff keeps its slot and its facing, and leaves its falloff entries as they were.
 */
export function writeAreaLightUniforms(lights: readonly SceneLight[], camera: THREE.Camera): void {
  const slotted = slottedAreaLights(lights, camera);
  arrays.write(slotted.length, (set) =>
    slotted.forEach((light, index) => writeLight(set, index, light, camera))
  );
}
