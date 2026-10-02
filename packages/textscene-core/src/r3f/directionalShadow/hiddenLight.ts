/**
 * Hides a declared directional light from three's render through its layers, and hands them back.
 * R3F owns the light's `visible` and its `castShadow`, so the fitter leaves both alone. A light that
 * fails the camera's layer test never enters the render's light list (`WebGLRenderer.js:1864-1888`),
 * while its children still do.
 */

import type * as THREE from 'three';
import { freeShadowMap } from './shadowMapAllocation.js';

/**
 * Each hidden light's own layer mask. Written only by `hideLight`. An entry clears when `showLight`
 * hands the mask back.
 */
const ownMasks = new WeakMap<THREE.Light, number>();

/** Takes the light off every layer. A second call keeps the mask the first one saved. */
export function hideLight(light: THREE.DirectionalLight): void {
  if (ownMasks.has(light)) return;
  ownMasks.set(light, light.layers.mask);
  light.layers.disableAll();
  // The hidden light draws no shadow, so a map it drew before only holds memory.
  freeShadowMap(light.shadow);
}

/** Puts a hidden light back on its own layers. A light never hidden stays as it is. */
export function showLight(light: THREE.DirectionalLight): void {
  const mask = ownMasks.get(light);
  if (mask === undefined) return;
  ownMasks.delete(light);
  light.layers.mask = mask;
}

/** The layers the light renders on when it is not hidden. */
export function ownLayerMask(light: THREE.DirectionalLight): number {
  return ownMasks.get(light) ?? light.layers.mask;
}
