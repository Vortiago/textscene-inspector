/**
 * Godot's 32-bit `VisualInstance3D.layers` mask on the THREE object graph. A decal
 * draws on an instance only when `decal.cull_mask & instance.layer_mask` is non-zero
 * (`scene_forward_clustered.glsl`, `renderer_scene_cull.cpp`). The mask is per
 * instance, not inherited, so a reader looks at one object, never its ancestors.
 */

import type * as THREE from 'three';

/** `VisualInstance3D::layers` default: layer 1 only (`visual_instance_3d.h`). */
export const GODOT_DEFAULT_VISUAL_LAYERS = 1;

/**
 * The `userData` key the mask travels under, not `THREE.Object3D.layers`: that is
 * three's camera-cull state, used by the 2D lighting passes, and would hide a masked
 * mesh from the main camera.
 */
const VISUAL_LAYERS_KEY = 'godotLayers';

/**
 * The `userData` object a visual-instance component hands R3F, such as
 * `<mesh userData={visualLayersUserData(properties.layers)} />`. Absent `layers`
 * resolves to Godot's default here, so a mesh's tag always states its mask.
 */
export function visualLayersUserData(layers?: number): { godotLayers: number } {
  return { [VISUAL_LAYERS_KEY]: layers ?? GODOT_DEFAULT_VISUAL_LAYERS };
}

/**
 * The Godot render-layer mask of one object. An untagged object (a slice that does
 * not model `layers`, or a helper) reads as Godot's default, as an unset `layers` does.
 */
export function visualLayersOf(object: THREE.Object3D): number {
  const layers = object.userData[VISUAL_LAYERS_KEY];
  return typeof layers === 'number' ? layers : GODOT_DEFAULT_VISUAL_LAYERS;
}

/**
 * Stamp the mask onto `object` and everything beneath it, for the GLB path: one glTF
 * node with several primitives becomes a Group of Meshes in three, and readers do not
 * inherit.
 */
export function stampVisualLayers(object: THREE.Object3D, layers: number): void {
  // `traverse` visits `object` itself first, so the subtree root is covered too.
  object.traverse((child) => {
    child.userData[VISUAL_LAYERS_KEY] = layers;
  });
}
