/**
 * Whether a live scene draws anything through the blend equation.
 *
 * Godot blends into a linear HDR buffer and tonemaps afterwards
 * (`render_forward_clustered.cpp:2389` then `:2514`); three tonemaps and encodes
 * per fragment, so blending in the drawing buffer meets two already-curved
 * operands. This says when a scene can tell the difference, and therefore when
 * the compositor has to run.
 *
 * Separate from the hook that calls it so it can be exercised against a plain
 * `THREE.Scene`, as `bloomableScan.ts` is.
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
