/**
 * The fade of a mesh built outside React, such as a GLB's: before each render, each surface slot
 * holds its unfaded material, or a copy of it with the fade alpha in its opacity, in its own pass
 * or in the alpha pass. Any other writer of the slot reads the unfaded material through
 * `unfadedMaterial`. Each mesh builds its own copies: an import remap puts one material on many
 * meshes, each at its own fade.
 */

import * as THREE from 'three';
import { fadeAlpha, forcesAlphaPass } from '../../godot/rendering/fadeAlpha';
import { composeInjections, injectProgram, type ProgramInjection } from '../materialProgramInputs';
import { importedNormalMapRead } from './godotNormalMap';
import { bindLightmap, LIGHTMAP_PROGRAM, readsLightmap } from '../lightmap/lightmapProgram';
import type { LightmapAssignment } from '../lightmap/sceneLightmaps';
import type { MeshSurface } from '../../resources/formats/glb/meshInstances';
import type { FadedSurface } from './swappedMaterials';
import type { FadePass, FadeVariants } from './fadeVariants';
import { surfaceAlphaProps, type SurfaceAlphaSource } from './surfaceAlphaPatch';
import { FADED_OPAQUE_PREPASS, opaquePrepassOf, opaquePrepassUserData } from './opaquePrepass';

/** What builds a copy for one pass, with `extra` composed after the copy's own injections. */
type CopyBuilder = (extra?: ProgramInjection) => THREE.Material;

/** Each unfaded material's copy builders. Written only by `registerFadedCopyBuilders`. */
const copyBuilders = new WeakMap<THREE.Material, FadeVariants<CopyBuilder>>();
/** Each faded copy's unfaded material. Written only by `FadedMeshMaterials`, as it builds one. */
const unfadedMaterials = new WeakMap<THREE.Material, THREE.Material>();

/**
 * Gives `unfaded` what builds its faded copy in each pass, on its first fade there. A material
 * derived from Godot's own registers its derivation's variants, in place of a plain copy.
 */
export function registerFadedCopyBuilders(
  unfaded: THREE.Material,
  builders: FadeVariants<CopyBuilder>
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
  injectProgram(copy, composeInjections([importedNormalMapRead(material), injection]));
  return copy;
}

/**
 * The plain copy of an imported `material` that draws in `pass`, with the import's normal map read.
 * A copy carries no `onBeforeCompile`, so each copy takes its injections again.
 */
function plainCopy(material: THREE.Material, pass: FadePass, extra?: ProgramInjection): THREE.Material {
  if (pass === 'alphaPass') return alphaPassCopy(material);
  const copy = material.clone();
  injectProgram(copy, composeInjections([importedNormalMapRead(material), extra]));
  return copy;
}

/** A faded copy's pass, or the unfaded pass of a surface that reads its lightmap. */
type CopyKind = FadePass | 'lightmapped';

/** Whether an imported material reads a lightmap: glTF imports as a lit StandardMaterial3D. */
function readsImportedLightmap(material: THREE.Material): boolean {
  return readsLightmap(
    (material as THREE.MeshStandardMaterial).isMeshStandardMaterial === true,
    material.transparent
  );
}

/** A faded copy, and the listener that disposes it with its unfaded material. */
interface BuiltCopy {
  material: THREE.Material;
  disposeWithUnfaded: () => void;
}

export class FadedMeshMaterials implements FadedSurface {
  /** Each unfaded material's copy of each kind for this mesh, built on its first draw as that kind. */
  private readonly copies = new Map<THREE.Material, Partial<Record<CopyKind, BuiltCopy>>>();
  /** Written only by `setLightmap`: the LightmapGI that names the mesh. */
  private lightmap: LightmapAssignment | null = null;

  constructor(private readonly mesh: MeshSurface) {}

  applyFade(fade: number): void {
    const { material } = this.mesh;
    if (!Array.isArray(material)) {
      this.mesh.material = this.placed(material, fade);
      return;
    }
    for (let i = 0; i < material.length; i++) material[i] = this.placed(material[i]!, fade);
  }

  /** Reads `lightmap` from the next fade on, or none. */
  setLightmap(lightmap: LightmapAssignment | null): void {
    this.lightmap = lightmap;
    for (const kinds of this.copies.values()) {
      if (kinds.lightmapped) bindLightmap(kinds.lightmapped.material, lightmap);
    }
  }

  /** Puts each slot's unfaded material back, and disposes every faded copy this mesh built. */
  dispose(): void {
    this.applyFade(1);
    for (const [unfaded, kinds] of this.copies) {
      for (const { material, disposeWithUnfaded } of Object.values(kinds)) {
        unfaded.removeEventListener('dispose', disposeWithUnfaded);
        material.dispose();
      }
    }
    this.copies.clear();
  }

  /**
   * The material a slot holding `current` draws at `fade`. Godot starts ALPHA from the fade byte
   * in every pass (`scene_forward_clustered.glsl:1251`), so a fade short of a full byte draws a
   * copy even in the surface's own pass, where it lowers what a cut keeps. The surface's own pass
   * reads its lightmap through a copy of its own, as the mesh's lightmap is its own.
   */
  private placed(current: THREE.Material, fade: number): THREE.Material {
    const unfaded = unfadedMaterial(current);
    const alpha = fadeAlpha(fade);
    const kind = this.kindAt(unfaded, fade);
    if (kind === 'unfaded' && alpha === 1) return unfaded;
    const copy = this.copyOf(unfaded, kind);
    copy.opacity = unfaded.opacity * alpha;
    return copy;
  }

  private kindAt(unfaded: THREE.Material, fade: number): CopyKind {
    if (forcesAlphaPass(fade)) return 'alphaPass';
    return this.lightmap && readsImportedLightmap(unfaded) ? 'lightmapped' : 'unfaded';
  }

  /** `unfaded`'s copy of `kind`, built once for this mesh and disposed with it. */
  private copyOf(unfaded: THREE.Material, kind: CopyKind): THREE.Material {
    let kinds = this.copies.get(unfaded);
    if (!kinds) {
      kinds = {};
      this.copies.set(unfaded, kinds);
    }
    const known = kinds[kind];
    if (known) return known.material;
    const material = this.built(unfaded, kind);
    const disposeWithUnfaded = () => material.dispose();
    unfaded.addEventListener('dispose', disposeWithUnfaded);
    unfadedMaterials.set(material, unfaded);
    kinds[kind] = { material, disposeWithUnfaded };
    return material;
  }

  private built(unfaded: THREE.Material, kind: CopyKind): THREE.Material {
    const builders = copyBuilders.get(unfaded);
    if (kind !== 'lightmapped') return builders?.[kind]() ?? plainCopy(unfaded, kind);
    const material = builders?.unfaded(LIGHTMAP_PROGRAM) ?? plainCopy(unfaded, 'unfaded', LIGHTMAP_PROGRAM);
    bindLightmap(material, this.lightmap);
    return material;
  }
}
