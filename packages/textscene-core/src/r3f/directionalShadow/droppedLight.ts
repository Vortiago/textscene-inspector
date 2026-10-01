/**
 * Takes a declared directional light out of three's render while it stands past Godot's eighth
 * drawn directional light. Godot draws no such light (`renderer_scene_cull.cpp:3262`), so it
 * neither lights nor casts. The light leaves through its layers, as it does while a split sun
 * shades for it: R3F owns its `visible` and its `castShadow`.
 */

import type * as THREE from 'three';
import { freeShadowMap } from './shadowMapAllocation.js';
import { releaseSplitSun } from './splitSun.js';

/**
 * Each dropped light's own layer mask. Written only by `dropLight`. An entry clears when
 * `restoreDroppedLight` hands the mask back or the light leaves its parent.
 */
const droppedMasks = new WeakMap<THREE.DirectionalLight, number>();

export function isDropped(light: THREE.DirectionalLight): boolean {
  return droppedMasks.has(light);
}

/**
 * Takes the light out of the render. A light that fails the camera's layer test never enters the
 * render's light list (`WebGLRenderer.js:1864-1888`). A second call changes nothing.
 */
export function dropLight(light: THREE.DirectionalLight): void {
  if (isDropped(light)) return;
  releaseSplitSun(light);
  droppedMasks.set(light, light.layers.mask);
  light.layers.disableAll();
  // The dropped light draws no shadow, so a map it drew before only holds memory.
  freeShadowMap(light.shadow);
  light.addEventListener('removed', restoreRemovedLight);
}

/** Puts a dropped light back in the render with its own layers. Any other light stays as it is. */
export function restoreDroppedLight(light: THREE.DirectionalLight): void {
  const mask = droppedMasks.get(light);
  if (mask === undefined) return;
  light.removeEventListener('removed', restoreRemovedLight);
  droppedMasks.delete(light);
  light.layers.mask = mask;
}

/** A light that leaves the scene leaves the fitter's reach, so it takes its own layers back. */
function restoreRemovedLight(event: { target: THREE.Object3D }): void {
  restoreDroppedLight(event.target as THREE.DirectionalLight);
}
