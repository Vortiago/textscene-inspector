/**
 * The fade of a mesh built outside React, such as a GLB's: before each render, each surface slot
 * holds its unfaded material, or that material's alpha-pass copy with the fade alpha in its
 * opacity. Any other writer of the slot reads the unfaded material through `unfadedMaterial`.
 * Each mesh builds its own copy: an import remap puts one material on many meshes, each at its
 * own fade.
 */

import * as THREE from 'three';
import { fadeAlpha, forcesAlphaPass } from '../../godot/fadeAlpha';
import { injectProgram } from '../materialProgramInputs';
import type { MeshSurface } from '../../resources/formats/glb/meshInstances';
import type { FadedSurface } from './swappedMaterials';
import { surfaceAlphaProps, type SurfaceAlphaSource } from './surfaceAlphaPatch';

/** Each unfaded material's alpha-pass builder. Written only by `registerAlphaPassBuilder`. */
const alphaPassBuilders = new WeakMap<THREE.Material, () => THREE.Material>();
/** Each alpha-pass material by its unfaded one. Written only by `FadedMeshMaterials`, as it builds one. */
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

/** An alpha-pass material, and the listener that disposes it with its unfaded material. */
interface BuiltAlphaPass {
  material: THREE.Material;
  disposeWithUnfaded: () => void;
}

export class FadedMeshMaterials implements FadedSurface {
  /** Each unfaded material's alpha-pass one for this mesh, built on its first fade. */
  private readonly alphaPasses = new Map<THREE.Material, BuiltAlphaPass>();

  constructor(private readonly mesh: MeshSurface) {}

  applyFade(fade: number): void {
    const isAlphaPass = forcesAlphaPass(fade);
    const alpha = fadeAlpha(fade);
    const { material } = this.mesh;
    if (!Array.isArray(material)) {
      this.mesh.material = this.placed(material, isAlphaPass, alpha);
      return;
    }
    for (let i = 0; i < material.length; i++) material[i] = this.placed(material[i]!, isAlphaPass, alpha);
  }

  /** Puts each slot's unfaded material back, and disposes every alpha-pass material this mesh built. */
  dispose(): void {
    this.applyFade(1);
    for (const [unfaded, { material, disposeWithUnfaded }] of this.alphaPasses) {
      unfaded.removeEventListener('dispose', disposeWithUnfaded);
      material.dispose();
    }
    this.alphaPasses.clear();
  }

  /** The material a slot holding `current` draws at the fade: its unfaded one, or that one's alpha pass. */
  private placed(current: THREE.Material, isAlphaPass: boolean, alpha: number): THREE.Material {
    const unfaded = unfadedMaterial(current);
    if (!isAlphaPass) return unfaded;
    const alphaPass = this.alphaPassOf(unfaded);
    alphaPass.opacity = unfaded.opacity * alpha;
    return alphaPass;
  }

  /** `unfaded` in the alpha pass, built once for this mesh and disposed with it. */
  private alphaPassOf(unfaded: THREE.Material): THREE.Material {
    const known = this.alphaPasses.get(unfaded);
    if (known) return known.material;
    const material = alphaPassBuilders.get(unfaded)?.() ?? alphaPassCopy(unfaded);
    const disposeWithUnfaded = () => material.dispose();
    unfaded.addEventListener('dispose', disposeWithUnfaded);
    unfadedMaterials.set(material, unfaded);
    this.alphaPasses.set(unfaded, { material, disposeWithUnfaded });
    return material;
  }
}
