/**
 * Each area light's Godot terms that three's `RectAreaLight` struct lacks, in two uniform arrays
 * that every lit program reads by the light's index: the view-space direction the light shines in,
 * and its inverse range, attenuation and specular amount. A scene writes them before each render,
 * in the order three gives its rect area lights their slots.
 */

import * as THREE from 'three';
import type { SceneLight } from '../directionalShadow/lightLists.js';
import { sceneLights } from '../directionalShadow/lightLists.js';
import { installedUniformValue, installLitUniform } from '../shaderPatch/litUniform.js';
import { observeSceneCamera } from '../sceneRenderCamera.js';

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

function newestBuffers(): AreaLightBuffers {
  return buffers[buffers.length - 1]!;
}

/** The arrays the next program to compile reads, which `installGodotAreaLight` installs. */
export function areaLightUniformValues(): AreaLightBuffers {
  return newestBuffers();
}

function growTo(count: number): void {
  const capacity = newestBuffers().facings.length / 3;
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
 * Godot's direction (4.7.2: `light_storage.cpp:1068`) and its `inv_radius` and `specular_amount`
 * (`:1056`, `:1060-1061`), at `index` of `pair`.
 */
function writeLight(pair: AreaLightBuffers, index: number, light: THREE.RectAreaLight, camera: THREE.Camera) {
  const falloff = readFalloff(light);
  if (!falloff) return;
  scratchFacing
    .set(0, 0, -1)
    .transformDirection(light.matrixWorld)
    .transformDirection(camera.matrixWorldInverse)
    .toArray(pair.facings, index * 3);
  pair.falloffs.set(
    [1 / Math.max(0.001, falloff.range), falloff.attenuation, falloff.specular * 2],
    index * 3
  );
}

/**
 * Writes the slotted lights among `lights` into every buffer, for a render through `camera`. A
 * light without a falloff keeps its slot and leaves its entries as they were.
 */
export function writeAreaLightUniforms(lights: readonly SceneLight[], camera: THREE.Camera): void {
  const slotted = slottedAreaLights(lights, camera);
  growTo(slotted.length);
  for (const pair of buffers) {
    const count = Math.min(slotted.length, pair.facings.length / 3);
    for (let index = 0; index < count; index += 1) writeLight(pair, index, slotted[index]!, camera);
  }
}

/** The area lights each observed scene holds. Written only by `observeAreaLight`. */
const observedScenes = new WeakMap<THREE.Scene, { lights: Set<THREE.RectAreaLight>; stop: () => void }>();

/**
 * Writes the uniforms before every render of the scene `light` sits in, until the returned
 * disposer runs and no other light of that scene is observed. A light outside a scene writes
 * nothing, as no render reaches it.
 */
export function observeAreaLight(light: THREE.RectAreaLight): () => void {
  const scene = sceneOf(light);
  if (!scene) return () => {};
  const observed = observedScenes.get(scene) ?? {
    lights: new Set<THREE.RectAreaLight>(),
    stop: observeSceneCamera(scene, (camera) => writeAreaLightUniforms(sceneLights(scene), camera)),
  };
  observedScenes.set(scene, observed);
  observed.lights.add(light);
  return () => {
    observed.lights.delete(light);
    if (observed.lights.size > 0) return;
    observed.stop();
    observedScenes.delete(scene);
  };
}

function sceneOf(object: THREE.Object3D): THREE.Scene | null {
  let root = object;
  while (root.parent) root = root.parent;
  return (root as THREE.Scene).isScene ? (root as THREE.Scene) : null;
}
