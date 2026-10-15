/**
 * Godot's 32-bit `VisualInstance3D.layers` mask on the THREE object graph. A decal draws on an
 * instance, and a reflection probe captures or reflects on it, only when its mask shares a bit
 * with the instance's (`scene_forward_clustered.glsl`, `renderer_scene_cull.cpp`). The mask is
 * per instance, not inherited, so a reader looks at one object, never its ancestors.
 */

import type * as THREE from 'three';
import { GODOT_DEFAULT_VISUAL_LAYERS } from '../godot/scene/visualLayers.js';

/**
 * The `userData` key the mask travels under, not `THREE.Object3D.layers`: that is
 * three's camera-cull state, used by the 2D lighting passes, and would hide a masked
 * mesh from the main camera.
 */
const VISUAL_LAYERS_KEY = 'godotLayers';

/**
 * The `userData` object a visual-instance component hands R3F, such as
 * `<mesh userData={visualLayersUserData(properties.layers)} />`.
 */
export function visualLayersUserData(layers: number): { godotLayers: number } {
  return { [VISUAL_LAYERS_KEY]: layers };
}

/**
 * The Godot render-layer mask of one object. An untagged object (a slice that does
 * not model `layers`, or a helper) reads as Godot's default, as an unset `layers` does.
 */
export function visualLayersOf(object: THREE.Object3D): number {
  const layers = object.userData[VISUAL_LAYERS_KEY];
  return typeof layers === 'number' ? layers : GODOT_DEFAULT_VISUAL_LAYERS;
}

/** Whether `mask` admits `object`: Godot's test, that the mask and the instance's layers share a bit. */
export function isInMask(object: THREE.Object3D, mask: number): boolean {
  return (mask & visualLayersOf(object)) !== 0;
}

/** Sets the mask of one object built outside JSX, such as a GLB's mesh. */
export function setVisualLayers(object: THREE.Object3D, layers: number): void {
  object.userData[VISUAL_LAYERS_KEY] = layers;
}
