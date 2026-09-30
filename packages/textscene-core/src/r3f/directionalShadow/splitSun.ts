/**
 * The light that shades for a declared directional light that draws parallel splits. three's
 * WebGL renderer draws a split atlas only for a light on its sun path (`isSunLight`), and that
 * path reads the light's direction from its world position (`WebGLLights.js:566-571`), not from a
 * target. So the fitter hangs this light under the declared one, points it by its world matrix,
 * and hides the declared light from the render, which then shades through this one alone.
 */

import * as THREE from 'three';
import { DirectionalSplitShadow } from './splitShadow.js';

export class SplitSunLight extends THREE.Light {
  /** The flag `WebGLLights` reads to put a light on the sun path (`WebGLLights.js:289`, `:566`). */
  readonly isSunLight = true;

  /** `WebGLLights` keys its uniform caches on this string (`WebGLLights.js:26`, `:102`). */
  override readonly type: string = 'SunLight';

  readonly shadow = new DirectionalSplitShadow();

  /** The declared light's layers from before the fitter hid it, restored on release. */
  readonly sourceLayers = new THREE.Layers();

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

/** Nothing for a light that has no split sun. */
export function splitSunOf(light: THREE.DirectionalLight): SplitSunLight | null {
  return (light.children.find((child) => child instanceof SplitSunLight) as SplitSunLight) ?? null;
}

/** The light's split sun, attached on the first call. The declared light stops shading then. */
export function attachSplitSun(light: THREE.DirectionalLight): SplitSunLight {
  const existing = splitSunOf(light);
  if (existing) return existing;
  const sun = new SplitSunLight();
  sun.sourceLayers.mask = light.layers.mask;
  sun.layers.mask = light.layers.mask;
  // A light that fails the camera's layer test never enters the render's light list
  // (`WebGLRenderer.js:1864-1888`), while its children still do.
  light.layers.disableAll();
  light.add(sun);
  // A light leaves the scene before the fitter can see it go, so it frees its own sun's atlas.
  light.addEventListener('removed', releaseRemovedLight);
  return sun;
}

/** Removes the light's split sun, if any, and lets the declared light shade again. */
export function releaseSplitSun(light: THREE.DirectionalLight): void {
  const sun = splitSunOf(light);
  if (!sun) return;
  light.removeEventListener('removed', releaseRemovedLight);
  light.layers.mask = sun.sourceLayers.mask;
  light.remove(sun);
  sun.dispose();
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
  const towardsLight = lightPosition.clone().sub(targetPosition);
  sun.matrixWorld.makeTranslation(towardsLight.x, towardsLight.y, towardsLight.z);
}
