/**
 * Each area light's Godot terms that three's `RectAreaLight` struct lacks, in two uniform arrays
 * that every lit program reads by the light's index: the view-space direction the light shines in,
 * and its range, attenuation and specular amount. The scene's light pass
 * (`SceneShadowFitter.tsx`) writes them before each render, in the order three gives its rect area
 * lights their slots.
 */

import * as THREE from 'three';
import type { SceneLight } from '../directionalShadow/lightLists.js';
import { installedUniformValue, installLitUniform } from '../shaderPatch/litUniform.js';

export const AREA_LIGHT_FACINGS = 'rectAreaLightFacings';
export const AREA_LIGHT_FALLOFFS = 'rectAreaLightFalloffs';

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

/** Three floats per light in each array. */
interface AreaLightBuffers {
  facings: Float32Array;
  falloffs: Float32Array;
}

/** Room for this many lights before the first growth. */
const INITIAL_CAPACITY = 4;

function createBuffers(capacity: number): AreaLightBuffers {
  return { facings: new Float32Array(capacity * 3), falloffs: new Float32Array(capacity * 3) };
}

/**
 * The buffers an earlier evaluation of this module gave the lit materials, as after a dev server
 * reloads it, or new ones.
 */
function initialBuffers(): AreaLightBuffers {
  const facings = installedUniformValue(AREA_LIGHT_FACINGS);
  const falloffs = installedUniformValue(AREA_LIGHT_FALLOFFS);
  if (facings instanceof Float32Array && falloffs instanceof Float32Array) return { facings, falloffs };
  return createBuffers(INITIAL_CAPACITY);
}

/**
 * Every pair of buffers handed to the lit materials, oldest first. A material clones the newest
 * pair when it compiles a program, and growth comes before any program with more lights, so each
 * program reads no further than its pair holds. Written only by `writeAreaLightUniforms`.
 */
const buffers: AreaLightBuffers[] = [initialBuffers()];

/** The arrays the next program to compile reads, which `installGodotAreaLight` installs. */
export function areaLightUniformValues(): AreaLightBuffers {
  return buffers[buffers.length - 1]!;
}

function growTo(count: number): void {
  const capacity = areaLightUniformValues().facings.length / 3;
  if (count <= capacity) return;
  const grown = createBuffers(Math.max(count, capacity * 2));
  buffers.push(grown);
  installLitUniform(AREA_LIGHT_FACINGS, grown.facings);
  installLitUniform(AREA_LIGHT_FALLOFFS, grown.falloffs);
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
 * (`:1060-1061`) and its `specular_amount` (`:1056`), at `index` of `pair`. The direction needs no
 * falloff, so a light without one still faces its own way.
 */
function writeLight(pair: AreaLightBuffers, index: number, light: THREE.RectAreaLight, camera: THREE.Camera) {
  const offset = index * 3;
  scratchFacing
    .set(0, 0, -1)
    .transformDirection(light.matrixWorld)
    .transformDirection(camera.matrixWorldInverse)
    .toArray(pair.facings, offset);
  const falloff = readFalloff(light);
  if (!falloff) return;
  pair.falloffs[offset] = Math.max(0.001, falloff.range);
  pair.falloffs[offset + 1] = falloff.attenuation;
  pair.falloffs[offset + 2] = falloff.specular * 2;
}

/**
 * Writes the slotted lights among `lights` into the newest buffers, then copies them into each older
 * pair as far as it holds, for a render through `camera`. A light without a falloff keeps its slot
 * and its facing, and leaves its falloff entries as they were.
 */
export function writeAreaLightUniforms(lights: readonly SceneLight[], camera: THREE.Camera): void {
  const slotted = slottedAreaLights(lights, camera);
  growTo(slotted.length);
  const newest = areaLightUniformValues();
  slotted.forEach((light, index) => writeLight(newest, index, light, camera));
  for (const pair of buffers) {
    if (pair === newest) continue;
    const length = Math.min(slotted.length * 3, pair.facings.length);
    pair.facings.set(newest.facings.subarray(0, length));
    pair.falloffs.set(newest.falloffs.subarray(0, length));
  }
}
