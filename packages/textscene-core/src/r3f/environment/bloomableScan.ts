/**
 * Whether a live scene holds anything the glow bright-pass would catch.
 *
 * Separate from the hook that calls it so the traversal can be exercised against a
 * plain `THREE.Scene`: the decision it feeds — whether to mount the compositor at
 * all — is one of the more consequential in the render layer, and through a React
 * hook it is only reachable by rendering a canvas.
 *
 * The predicate has to agree with `godotGlow.ts`'s bright pass or the gate is
 * wrong in one direction or the other: Godot gates on the PEAK RGB channel, so a
 * saturated blue emissive counts by its blue channel alone even though its Rec. 709
 * luminance is the lowest in the frame. Diffuse-only brightness — a lit white
 * floor, unshaded text near 1.0 — stays below the threshold and does not count,
 * which is what Godot does too.
 */

import type * as THREE from 'three';

export function sceneHasBloomableEmissive(scene: THREE.Object3D, threshold: number): boolean {
  let found = false;
  scene.traverse((object) => {
    if (found) return;
    const material = (object as THREE.Mesh).material;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    for (const candidate of materials) {
      const standard = candidate as THREE.MeshStandardMaterial;
      const emissive = standard.emissive;
      const intensity = standard.emissiveIntensity ?? 0;
      if (
        emissive &&
        intensity > 0 &&
        Math.max(emissive.r, emissive.g, emissive.b) * intensity > threshold
      ) {
        found = true;
        return;
      }
    }
  });
  return found;
}
