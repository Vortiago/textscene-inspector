/**
 * Whether a live scene holds anything the glow bright pass catches, agreeing with `godotGlow.ts`.
 * Godot gates on the peak RGB channel, so a saturated blue emissive counts by its blue alone, and
 * diffuse-only brightness does not. The threshold is in material space (`unexposedBrightPassThreshold`).
 */

import * as THREE from 'three';
import { addedEmissionTextureEnergy } from '../materials/emissionTextureAdd';

/**
 * The colour's peak at its intensity, plus the most an ADD emission texture adds: a texel of 1 at
 * its energy. A float emission map has no such ceiling, so any emission over it counts. An upper
 * bound, as the scan only decides whether the bright pass runs.
 */
function isBloomable(material: THREE.Material, threshold: number): boolean {
  const standard = material as THREE.MeshStandardMaterial;
  const emissive = standard.emissive;
  if (!emissive) return false;
  const colourPeak =
    Math.max(emissive.r, emissive.g, emissive.b) * Math.max(0, standard.emissiveIntensity ?? 0);
  const emission = colourPeak + addedEmissionTextureEnergy(material);
  return emission > threshold || (emission > 0 && hasFloatEmissiveMap(standard));
}

/** A float emission map, such as an HDR GradientTexture2D, can hold a texel above 1. */
function hasFloatEmissiveMap(material: THREE.MeshStandardMaterial): boolean {
  const type = material.emissiveMap?.type;
  return type === THREE.HalfFloatType || type === THREE.FloatType;
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
