/**
 * Whether a live scene holds anything the glow bright-pass would catch.
 *
 * Separate from the hook that calls it so the traversal can be exercised against a
 * plain `THREE.Scene`: the decision it feeds — whether to mount the compositor at
 * all — is one of the more consequential in the render layer, and through a React
 * hook it is only reachable by rendering a canvas.
 *
 * The predicate has to agree with `godotGlow.ts`'s bright pass or the gate is wrong
 * in one direction or the other. Godot gates on the PEAK RGB channel, so a
 * saturated blue emissive counts by its blue channel alone even though its Rec. 709
 * luminance is the lowest in the frame. Diffuse-only brightness — a lit white floor,
 * unshaded text near 1.0 — stays below the threshold and does not count, which is
 * what Godot does too. The threshold passed in must already be in the same space as
 * the material values being read: see `unexposedBrightPassThreshold`.
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
 * Walked with an explicit stack rather than `Object3D.traverse`, for two reasons
 * measured on the largest bundled scene (~6,000 objects after r3f wraps every node
 * in a group). `traverse` cannot stop: returning from its callback skips the body
 * but three still visits every remaining descendant, so a hit on the second object
 * costs the same as no hit at all. And the answer is usually found near the root,
 * because emissive meshes are authored content — so the early exit is worth two
 * orders of magnitude when it lands, and skipping non-mesh objects without
 * allocating an empty array for each is worth about half the remaining time when it
 * does not.
 *
 * Children are pushed in REVERSE so that popping yields preorder document order,
 * the same order `traverse` visits in. Pushing them forward inverts it and finds a
 * shallow first-child emissive last, which measures no faster than `traverse` at
 * all — the early exit only pays if the order is right.
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
