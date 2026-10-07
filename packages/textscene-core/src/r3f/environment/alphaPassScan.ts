/**
 * Whether a live scene draws anything through the blend equation, and so needs the compositor.
 * Godot blends in linear HDR and tonemaps after (`render_forward_clustered.cpp:2389` then `:2514`),
 * while three tonemaps per fragment and blends two curved operands.
 */

import type * as THREE from 'three';
import { isBlended } from '../materials/surfaceAlphaPatch';

/** Explicit stack for `sceneHasBloomableEmissive`'s reasons: `traverse` cannot stop early. */
export function sceneHasBlendedSurface(scene: THREE.Object3D): boolean {
  const stack: THREE.Object3D[] = [scene];
  while (stack.length > 0) {
    const object = stack.pop()!;
    const material = (object as THREE.Mesh).material;
    if (material) {
      if (Array.isArray(material)) {
        for (const entry of material) {
          if (isBlended(entry)) return true;
        }
      } else if (isBlended(material)) {
        return true;
      }
    }
    const children = object.children;
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]!);
  }
  return false;
}
