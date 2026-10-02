/**
 * Takes a declared directional light out of three's render while it stands past Godot's eighth
 * drawn directional light. Godot draws no such light (`renderer_scene_cull.cpp:3262`), so it
 * neither lights nor casts. The light leaves through its layers, as it does while a split sun
 * shades for it.
 */

import type * as THREE from 'three';
import { hideLight, showLight } from './hiddenLight.js';
import { releaseSplitSun } from './splitSun.js';

/**
 * The dropped lights. Written only by `dropLight`. An entry clears when `restoreDroppedLight` shows
 * the light again or the light leaves its parent.
 */
const droppedLights = new WeakSet<THREE.DirectionalLight>();

export function isDropped(light: THREE.DirectionalLight): boolean {
  return droppedLights.has(light);
}

/** Takes the light out of the render. A second call changes nothing. */
export function dropLight(light: THREE.DirectionalLight): void {
  if (isDropped(light)) return;
  // The sun hands the light its own layers back first, so the drop saves those.
  releaseSplitSun(light);
  hideLight(light);
  droppedLights.add(light);
  light.addEventListener('removed', restoreRemovedLight);
}

/** Puts a dropped light back in the render with its own layers. Any other light stays as it is. */
export function restoreDroppedLight(light: THREE.DirectionalLight): void {
  if (!isDropped(light)) return;
  light.removeEventListener('removed', restoreRemovedLight);
  droppedLights.delete(light);
  showLight(light);
}

/** A light that leaves the scene leaves the fitter's reach, so it takes its own layers back. */
function restoreRemovedLight(event: { target: THREE.Object3D }): void {
  restoreDroppedLight(event.target as THREE.DirectionalLight);
}
