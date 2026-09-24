/**
 * Whether a live scene holds anything the glow bright pass catches, agreeing with `godotGlow.ts`.
 * Godot gates on the peak RGB channel, so a saturated blue emissive counts by its blue alone, and
 * diffuse-only brightness does not. The threshold is in material space (`unexposedBrightPassThreshold`).
 */

import type * as THREE from 'three';

function isBloomable(material: THREE.Material, threshold: number): boolean {
  const standard = material as THREE.MeshStandardMaterial;
  const emissive = standard.emissive;
  const intensity = standard.emissiveIntensity ?? 0;
  return (
    !!emissive &&
    intensity > 0 &&
    Math.max(emissive.r, emissive.g, emissive.b) * intensity > threshold
  );
}

/**
 * An explicit stack, not `Object3D.traverse`, which cannot stop early: on the largest bundled scene
 * the early exit is worth two orders of magnitude, as emissive meshes sit near the root. Children
 * push in reverse so popping yields preorder, and the early exit pays only in that order. Skipping
 * a non-mesh object without allocating an empty array halves the time when no hit lands.
 */
export function sceneHasBloomableEmissive(scene: THREE.Object3D, threshold: number): boolean {
  const stack: THREE.Object3D[] = [scene];
  while (stack.length > 0) {
    const object = stack.pop()!;
    const material = (object as THREE.Mesh).material;
    if (material) {
      if (Array.isArray(material)) {
        for (const entry of material) {
          if (isBloomable(entry, threshold)) return true;
        }
      } else if (isBloomable(material, threshold)) {
        return true;
      }
    }
    const children = object.children;
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]!);
  }
  return false;
}
