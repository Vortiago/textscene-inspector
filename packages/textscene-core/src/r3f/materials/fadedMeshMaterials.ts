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

/** Each unfaded material's alpha-pass builder. Written only by `registerAlphaPassBuilder`. */
const alphaPassBuilders = new WeakMap<THREE.Material, () => THREE.Material>();
/** Each unfaded material's alpha-pass one, built on its first fade. Written only by `alphaPassOf`. */
const alphaPassMaterials = new WeakMap<THREE.Material, THREE.Material>();
/** Each unfaded material by its alpha-pass material, the inverse of `alphaPassMaterials`. */
const unfadedMaterials = new WeakMap<THREE.Material, THREE.Material>();

/**
 * Gives `unfaded` what builds the material it draws as in the alpha pass, on its first fade. A
 * material derived from Godot's own registers its derivation's variant, in place of a copy.
 */
export function registerAlphaPassBuilder(unfaded: THREE.Material, build: () => THREE.Material): void {
  alphaPassBuilders.set(unfaded, build);
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

/** `material` in the alpha pass, built once and disposed with it. */
function alphaPassOf(material: THREE.Material): THREE.Material {
  const known = alphaPassMaterials.get(material);
  if (known) return known;
  const alphaPass = alphaPassBuilders.get(material)?.() ?? alphaPassCopy(material);
  alphaPassMaterials.set(material, alphaPass);
  unfadedMaterials.set(alphaPass, material);
  material.addEventListener('dispose', () => alphaPass.dispose());
  return alphaPass;
}

/**
 * A copy of `material` for the alpha pass: blended, with no depth write, as Godot's default
 * DEPTH_DRAW_OPAQUE_ONLY writes none there.
 */
function alphaPassCopy(material: THREE.Material): THREE.Material {
  const copy = material.clone();
  copy.transparent = true;
  copy.depthWrite = false;
  const { blending, injection } = surfaceAlphaProps(importedAlphaSource(material), {
    transparent: true,
    blending: material.blending,
  });
  if (blending !== undefined) copy.blending = blending;
  if (injection) injectProgram(copy, injection);
  return copy;
}

export class FadedMeshMaterials implements FadedSurface {
  constructor(private readonly mesh: MeshSurface) {}

  applyFade(fade: number): void {
    const isAlphaPass = forcesAlphaPass(fade);
    const alpha = fadeAlpha(fade);
    const { material } = this.mesh;
    if (!Array.isArray(material)) {
      this.mesh.material = placed(material, isAlphaPass, alpha);
      return;
    }
    for (let i = 0; i < material.length; i++) material[i] = placed(material[i]!, isAlphaPass, alpha);
  }

  /** Puts each slot's unfaded material back. */
  restore(): void {
    this.applyFade(1);
  }
}

/** The material a slot holding `current` draws at the fade: its unfaded one, or that one's alpha pass. */
function placed(current: THREE.Material, isAlphaPass: boolean, alpha: number): THREE.Material {
  const unfaded = unfadedMaterial(current);
  if (!isAlphaPass) return unfaded;
  const alphaPass = alphaPassOf(unfaded);
  alphaPass.opacity = unfaded.opacity * alpha;
  return alphaPass;
}
