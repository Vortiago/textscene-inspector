/**
 * The fade of a mesh built outside React, such as a GLB's: before each render, each surface slot
 * holds its unfaded material, or that material's alpha-pass copy with the fade alpha in its
 * opacity. Any other writer of the slot reads the unfaded material through `unfadedMaterial`.
 */

import * as THREE from 'three';
import { fadeAlpha, forcesAlphaPass } from '../../godot/fadeAlpha';
import { injectProgram } from '../materialProgramInputs';
import type { MeshSurface } from '../../resources/formats/glb/meshInstances';
import type { FadedSurface } from './swappedMaterials';
import { surfaceAlphaProps, type SurfaceAlphaSource } from './surfaceAlphaPatch';

/** Each unfaded material's alpha-pass one. Written only by `registerAlphaPassMaterial`. */
const alphaPassMaterials = new WeakMap<THREE.Material, THREE.Material>();
/** Each unfaded material by its alpha-pass material, the inverse of `alphaPassMaterials`. */
const unfadedMaterials = new WeakMap<THREE.Material, THREE.Material>();

/**
 * Gives `unfaded` the material it draws as in the alpha pass, which is disposed with it. A
 * material derived from Godot's own registers the variant its derivation built, in place of a copy.
 */
export function registerAlphaPassMaterial(unfaded: THREE.Material, alphaPass: THREE.Material): void {
  alphaPassMaterials.set(unfaded, alphaPass);
  unfadedMaterials.set(alphaPass, unfaded);
  unfaded.addEventListener('dispose', () => alphaPass.dispose());
}

/** The material a slot holds unfaded: `material` itself, unless it is an alpha-pass material. */
export function unfadedMaterial(material: THREE.Material): THREE.Material {
  return unfadedMaterials.get(material) ?? material;
}

/**
 * Where a glTF material's Godot import takes its ALPHA from (`gltf_document.cpp:3117-3120`):
 * BLEND, which GLTFLoader marks `transparent`, and MASK, its `alphaTest`, read the albedo alpha,
 * and MASK writes 1 past the cut. OPAQUE imports as TRANSPARENCY_DISABLED, which reads none.
 */
function importedAlphaSource(material: THREE.Material): SurfaceAlphaSource {
  const isMask = material.alphaTest > 0;
  return { readsAlbedoAlpha: material.transparent || isMask, opaqueAfterCut: isMask };
}

/**
 * `material` in the alpha pass, built once: blended, with no depth write, as Godot's default
 * DEPTH_DRAW_OPAQUE_ONLY writes none there.
 */
function alphaPassOf(material: THREE.Material): THREE.Material {
  const known = alphaPassMaterials.get(material);
  if (known) return known;
  const copy = material.clone();
  copy.transparent = true;
  copy.depthWrite = false;
  const { blending, injection } = surfaceAlphaProps(importedAlphaSource(material), {
    transparent: true,
    blending: material.blending,
  });
  if (blending !== undefined) copy.blending = blending;
  if (injection) injectProgram(copy, injection);
  registerAlphaPassMaterial(material, copy);
  return copy;
}

export class FadedMeshMaterials implements FadedSurface {
  constructor(private readonly mesh: MeshSurface) {}

  applyFade(fade: number): void {
    const isAlphaPass = forcesAlphaPass(fade);
    const alpha = fadeAlpha(fade);
    const place = (current: THREE.Material): THREE.Material => {
      const unfaded = unfadedMaterial(current);
      if (!isAlphaPass) return unfaded;
      const alphaPass = alphaPassOf(unfaded);
      alphaPass.opacity = unfaded.opacity * alpha;
      return alphaPass;
    };
    const { material } = this.mesh;
    if (Array.isArray(material)) material.forEach((current, i) => (material[i] = place(current)));
    else this.mesh.material = place(material);
  }

  /** Puts each slot's unfaded material back. */
  restore(): void {
    this.applyFade(1);
  }
}
