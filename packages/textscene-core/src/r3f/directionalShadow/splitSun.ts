/**
 * The light that shades for a declared directional light in Godot's shadow list. three draws a
 * shadow with several splits only on its sun path (`isSunLight`), which reads the direction from
 * the world position (`WebGLLights.js:566-571`), not from a target. So the fitter hangs this light
 * under the declared one, points it by its world matrix, and hides the declared light.
 */

import * as THREE from 'three';
import { hideLight, ownLayerMask, showLight } from './hiddenLight.js';
import { DirectionalSplitShadow } from './splitShadow.js';

export class SplitSunLight extends THREE.Light {
  /** The flag `WebGLLights` reads to put a light on the sun path (`WebGLLights.js:289`, `:566`). */
  readonly isSunLight = true;

  /** `WebGLLights` caches by `id`, and shapes a new entry by this string (`WebGLLights.js:24`, `:100`). */
  override readonly type: string = 'SunLight';

  readonly shadow = new DirectionalSplitShadow();

  constructor() {
    super();
    this.name = 'DirectionalShadowSplits';
    this.castShadow = true;
    this.matrixAutoUpdate = false;
  }

  /** The fitter writes the world matrix before each render, so the scene update leaves it. */
  override updateMatrixWorld(): void {}

  override updateWorldMatrix(): void {}

  override dispose(): void {
    super.dispose();
    this.shadow.dispose();
  }
}

/**
 * Each light's split sun. Written only by `attachSplitSun` and `releaseSplitSun`, so the fitter
 * finds a sun without a search of the light's children on every render.
 */
const splitSuns = new WeakMap<THREE.DirectionalLight, SplitSunLight>();

/** Every attached split sun. Written only by `attachSplitSun` and `releaseSplitSun`. */
const attachedSuns = new Set<SplitSunLight>();

/** Nothing for a light that has no split sun, or whose sun something else took off it. */
export function splitSunOf(light: THREE.DirectionalLight): SplitSunLight | null {
  const sun = splitSuns.get(light);
  return sun?.parent === light ? sun : null;
}

/** The light's split sun, attached on the first call. The declared light stops shading then. */
export function attachSplitSun(light: THREE.DirectionalLight): SplitSunLight {
  const existing = splitSunOf(light);
  if (existing) return existing;
  const sun = new SplitSunLight();
  // The sun renders on the light's own layers while the light is hidden.
  sun.layers.mask = ownLayerMask(light);
  hideLight(light);
  light.add(sun);
  splitSuns.set(light, sun);
  attachedSuns.add(sun);
  // A light leaves the scene before the fitter can see it go, so it lets go of its own sun's share.
  light.addEventListener('removed', releaseRemovedLight);
  return sun;
}

/** Removes the light's split sun, if any, and lets the declared light shade again. */
export function releaseSplitSun(light: THREE.DirectionalLight): void {
  const sun = splitSunOf(light);
  if (!sun) return;
  light.removeEventListener('removed', releaseRemovedLight);
  splitSuns.delete(light);
  attachedSuns.delete(sun);
  showLight(light);
  light.remove(sun);
  sun.dispose();
}

/**
 * Whether a split of a sun in `scene` holds `box`: Godot culls a geometry instance for each
 * directional cascade as well as for the camera (`renderer_scene_cull.cpp:3140`).
 */
export function sunSplitsHold(scene: THREE.Scene, box: THREE.Box3): boolean {
  for (const sun of attachedSuns) {
    if (rootOf(sun) === scene && sun.shadow.holdsBox(box)) return true;
  }
  return false;
}

function rootOf(object: THREE.Object3D): THREE.Object3D {
  let root = object;
  while (root.parent) root = root.parent;
  return root;
}

function releaseRemovedLight(event: { target: THREE.Object3D }): void {
  releaseSplitSun(event.target as THREE.DirectionalLight);
}

/**
 * Copies what the declared light shades with, and points the sun as three points the declared
 * light: from its target towards its position (`WebGLLights.js:575-582`).
 */
export function followDeclaredLight(
  sun: SplitSunLight,
  light: THREE.DirectionalLight,
  lightPosition: THREE.Vector3,
  targetPosition: THREE.Vector3
): void {
  sun.color.copy(light.color);
  sun.intensity = light.intensity;
  sun.shadow.intensity = light.shadow.intensity;
  sun.shadow.radius = light.shadow.radius;
  sun.matrixWorld.makeTranslation(
    lightPosition.x - targetPosition.x,
    lightPosition.y - targetPosition.y,
    lightPosition.z - targetPosition.z
  );
}
