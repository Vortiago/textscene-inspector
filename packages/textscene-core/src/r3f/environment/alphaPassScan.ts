/**
 * Whether a live scene draws anything through the blend equation, and so needs the compositor.
 * Godot blends in linear HDR and tonemaps after (`render_forward_clustered.cpp:2389` then `:2514`),
 * while three tonemaps per fragment and blends two curved operands.
 */

import * as THREE from 'three';

// `WebGLState.setMaterial`: blending is off only for NormalBlending WITH
// `transparent === false`.
function blends(material: THREE.Material): boolean {
  if (material.blending === THREE.NoBlending) return false;
  return material.blending !== THREE.NormalBlending || material.transparent;
}

/** Explicit stack for `sceneHasBloomableEmissive`'s reasons: `traverse` cannot stop early. */
export function sceneHasBlendedSurface(scene: THREE.Object3D): boolean {
  const stack: THREE.Object3D[] = [scene];
  while (stack.length > 0) {
    const object = stack.pop()!;
    const material = (object as THREE.Mesh).material;
    if (material) {
      if (Array.isArray(material)) {
        for (const entry of material) {
          if (blends(entry)) return true;
        }
      } else if (blends(material)) {
        return true;
      }
    }
    const children = object.children;
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]!);
  }
  return false;
}
