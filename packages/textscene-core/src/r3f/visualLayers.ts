/**
 * Godot's `VisualInstance3D.layers` render-layer mask, carried on the THREE
 * object graph — render-side only.
 *
 * Godot gives every `VisualInstance3D` a 32-bit `layers` mask (the editor
 * exposes the first 20) and lets other nodes filter by it. `Decal.cull_mask` is
 * the first consumer here: Godot draws a decal on an instance only when
 * `decal.cull_mask & instance.layer_mask` is non-zero
 * (`scene_forward_clustered.glsl`, and the CPU-side pairing cull in
 * `renderer_scene_cull.cpp`), which is how a vehicle's blob shadow lands on the
 * ground without also painting the vehicle.
 *
 * The mask rides `userData` — the same cross-slice tagging convention
 * `sprite3d` (`billboardMode`), `camera2d` (`camera2d`) and the decal's own
 * `isDecalProjection` use. It deliberately does NOT ride `THREE.Object3D.layers`,
 * which is three's camera-cull state and is already load-bearing for the 2D
 * lighting passes (`r3f/lighting2d/CanvasLighting2D.tsx`,
 * `nodes/2d/pointlight2d/Component.tsx`); reusing it would make a masked mesh
 * invisible to the main camera rather than merely undecalled.
 *
 * The mask is per-instance and NOT inherited: Godot's default applies to any
 * node that does not set `layers`, whatever its parent carries. Readers
 * therefore look at one object, never at its ancestors.
 */

import type * as THREE from 'three';

/** `VisualInstance3D::layers` default — layer 1 only (`visual_instance_3d.h`). */
export const GODOT_DEFAULT_VISUAL_LAYERS = 1;

/** The `userData` key the mask travels under. */
const VISUAL_LAYERS_KEY = 'godotLayers';

/**
 * The `userData` object a visual-instance component hands R3F, e.g.
 * `<mesh userData={visualLayersUserData(properties.layers)} />`. Absent
 * `layers` resolves to Godot's default here rather than at read time, so a
 * mesh's tag always states its mask outright.
 */
export function visualLayersUserData(layers?: number): { godotLayers: number } {
  return { [VISUAL_LAYERS_KEY]: layers ?? GODOT_DEFAULT_VISUAL_LAYERS };
}

/**
 * The Godot render-layer mask of one object. Untagged objects — every mesh from
 * a slice that does not model `layers`, and every helper/gizmo — read as Godot's
 * default, which is what an unset `layers` means in a `.tscn`.
 */
export function visualLayersOf(object: THREE.Object3D): number {
  const layers = object.userData[VISUAL_LAYERS_KEY];
  return typeof layers === 'number' ? layers : GODOT_DEFAULT_VISUAL_LAYERS;
}

/**
 * Stamp the mask onto `object` and everything beneath it.
 *
 * The declarative `visualLayersUserData` covers a slice that renders its own
 * `<mesh>`. This covers the GLB path, where `layers` is authored on an override
 * node that matches a glTF node — and one glTF node with several primitives
 * becomes a Group of Meshes in three, while readers look at one object with no
 * inheritance. Stamping the subtree is what makes those meshes carry it.
 */
export function stampVisualLayers(object: THREE.Object3D, layers: number): void {
  // `traverse` visits `object` itself first, so the subtree root is covered too.
  object.traverse((child) => {
    child.userData[VISUAL_LAYERS_KEY] = layers;
  });
}
