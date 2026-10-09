/**
 * The fade of a mesh built outside React, such as a GLB's: before each render, each surface slot
 * holds its unfaded material, or a copy of it with the fade alpha in its opacity, in its own pass
 * or in the alpha pass. Any other writer of the slot reads the unfaded material through
 * `unfadedMaterial`. Each mesh builds its own copies: an import remap puts one material on many
 * meshes, each at its own fade.
 */

import * as THREE from 'three';
import { fadeAlpha, forcesAlphaPass } from '../../godot/fadeAlpha';
import { injectProgram } from '../materialProgramInputs';
import type { MeshSurface } from '../../resources/formats/glb/meshInstances';
import type { FadedSurface } from './swappedMaterials';
import type { FadePass, FadeVariants } from './fadeVariants';
import { surfaceAlphaProps, type SurfaceAlphaSource } from './surfaceAlphaPatch';
import { FADED_OPAQUE_PREPASS, opaquePrepassOf, opaquePrepassUserData } from './opaquePrepass';

/** Each unfaded material's copy builders. Written only by `registerFadedCopyBuilders`. */
const copyBuilders = new WeakMap<THREE.Material, FadeVariants<() => THREE.Material>>();
/** Each faded copy's unfaded material. Written only by `FadedMeshMaterials`, as it builds one. */
const unfadedMaterials = new WeakMap<THREE.Material, THREE.Material>();

/**
 * Gives `unfaded` what builds its faded copy in each pass, on its first fade there. A material
 * derived from Godot's own registers its derivation's variants, in place of a plain copy.
 */
export function registerFadedCopyBuilders(
  unfaded: THREE.Material,
  builders: FadeVariants<() => THREE.Material>
): void {
  copyBuilders.set(unfaded, builders);
}

/** The material a slot holds unfaded: `material` itself, unless it is a faded copy. */
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
 * DEPTH_DRAW_OPAQUE_ONLY writes none there. The fade keeps a depth-prepass surface out of the
 * depth prepass (`render_forward_clustered.cpp:1128-1134`), but its shadow still cuts.
 */
function alphaPassCopy(material: THREE.Material): THREE.Material {
  const copy = material.clone();
  copy.transparent = true;
  copy.depthWrite = false;
  if (opaquePrepassOf(material).cutsDepth) {
    Object.assign(copy.userData, opaquePrepassUserData(FADED_OPAQUE_PREPASS));
  }
  const { blending, injection } = surfaceAlphaProps(importedAlphaSource(material), {
    transparent: true,
    blending: material.blending,
  });
  if (blending !== undefined) copy.blending = blending;
  injectProgram(copy, injection);
  return copy;
}

/** The plain copy of an imported `material` that draws in `pass`. An import carries no program injection. */
function plainCopy(material: THREE.Material, pass: FadePass): THREE.Material {
  return pass === 'alphaPass' ? alphaPassCopy(material) : material.clone();
}

/** A faded copy, and the listener that disposes it with its unfaded material. */
interface BuiltCopy {
  material: THREE.Material;
  disposeWithUnfaded: () => void;
}

export class FadedMeshMaterials implements FadedSurface {
  /** Each unfaded material's faded copy in each pass for this mesh, built on its first fade there. */
  private readonly copies = new Map<THREE.Material, Partial<FadeVariants<BuiltCopy>>>();

  constructor(private readonly mesh: MeshSurface) {}

  applyFade(fade: number): void {
    const { material } = this.mesh;
    if (!Array.isArray(material)) {
      this.mesh.material = this.placed(material, fade);
      return;
    }
    for (let i = 0; i < material.length; i++) material[i] = this.placed(material[i]!, fade);
  }

  /** Puts each slot's unfaded material back, and disposes every faded copy this mesh built. */
  dispose(): void {
    this.applyFade(1);
    for (const [unfaded, passes] of this.copies) {
      for (const { material, disposeWithUnfaded } of Object.values(passes)) {
        unfaded.removeEventListener('dispose', disposeWithUnfaded);
        material.dispose();
      }
    }
    this.copies.clear();
  }

  /**
   * The material a slot holding `current` draws at `fade`. Godot starts ALPHA from the fade byte
   * in every pass (`scene_forward_clustered.glsl:1251`), so a fade short of a full byte draws a
   * copy even in the surface's own pass, where it lowers what a cut keeps.
   */
  private placed(current: THREE.Material, fade: number): THREE.Material {
    const unfaded = unfadedMaterial(current);
    const alpha = fadeAlpha(fade);
    if (alpha === 1) return unfaded;
    const copy = this.copyOf(unfaded, forcesAlphaPass(fade) ? 'alphaPass' : 'unfaded');
    copy.opacity = unfaded.opacity * alpha;
    return copy;
  }

  /** `unfaded`'s faded copy in `pass`, built once for this mesh and disposed with it. */
  private copyOf(unfaded: THREE.Material, pass: FadePass): THREE.Material {
    let passes = this.copies.get(unfaded);
    if (!passes) {
      passes = {};
      this.copies.set(unfaded, passes);
    }
    const known = passes[pass];
    if (known) return known.material;
    const material = copyBuilders.get(unfaded)?.[pass]() ?? plainCopy(unfaded, pass);
    const disposeWithUnfaded = () => material.dispose();
    unfaded.addEventListener('dispose', disposeWithUnfaded);
    unfadedMaterials.set(material, unfaded);
    passes[pass] = { material, disposeWithUnfaded };
    return material;
  }
}
