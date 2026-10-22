/**
 * `surface_material_override/0` on a mesh inside a loaded GLB. Not in the pure, synchronous
 * `applyGlbNodeOverrides`: its material may load asynchronously, which React handles
 * declaratively.
 */

import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import { MISSING_TEXTURE_MATERIAL } from '../../../resources/materials/standardmaterial3d/materialBag.js';
import { materialFromBag } from '../../../resources/materials/standardmaterial3d/build.js';
import { forEachSurfaceMaterial } from '../../../resources/formats/glb/surfaceMaterials.js';
import { GLTF_SURFACE } from '../../materials/surfaceTextures.js';
import { useSurfaceMaterial } from '../../materials/useSurfaceMaterial.js';
import type { MaterialSource } from '../../materials/materialSource.js';
import { registerFadedCopyBuilders, unfadedMaterial } from '../../materials/fadedMeshMaterials.js';
import { useDisposeOnRelease } from '../../useDisposeOnRelease.js';

interface GlbSurfaceMaterialOverrideProps {
  /** The GLB-internal object whose surface materials are being replaced. */
  target: THREE.Object3D;
  /** Where the override material lives, already resolved. */
  source: MaterialSource;
  /** Which surface materials under `target` it replaces. Every one by default. Stable identity. */
  replaces?: (current: THREE.Material) => boolean;
}

/**
 * The override material, built and disposed here: the target is a cloned GLB with no R3F element,
 * so it installs the bags of `useSurfaceMaterial` itself (ADR-0039). A material this previewer
 * cannot build still replaces the glTF's own with Godot's default (ADR-0041). One still loading,
 * or one that never loads, replaces nothing, as Godot's null does. A missing texture draws magenta.
 */
export function GlbSurfaceMaterialOverride({
  target,
  source,
  replaces = everySurface,
}: GlbSurfaceMaterialOverrideProps) {
  // The geometry is the glTF's: no Godot mesh sub-resource for a triplanar material to tile
  // against, and UVs in Godot's top-down V.
  const { isAbsent, bags } = useSurfaceMaterial(source, GLTF_SURFACE);
  const material = useMemo(() => {
    if (isAbsent) return null;
    if (!bags) return materialFromBag(MISSING_TEXTURE_MATERIAL);
    const unfaded = materialFromBag(bags.unfaded);
    registerFadedCopyBuilders(unfaded, {
      unfaded: (extra) => materialFromBag(bags.unfaded, extra),
      alphaPass: () => materialFromBag(bags.alphaPass),
    });
    return unfaded;
  }, [isAbsent, bags]);
  useDisposeOnRelease(material);
  useGlbMaterialSwap(target, material, replaces);
  return null;
}

/**
 * Puts `material` into every surface slot under `target` that `replaces` accepts: a glTF node
 * with several primitives arrives as a Group of Meshes. Restores each slot on unmount, since the
 * GLB clone is long-lived and a reload that dropped the override would leave the swap behind. A
 * slot another override has since taken keeps that override's material. A slot the range fade
 * holds in the alpha pass counts as its unfaded material, which the next fade draws again.
 */
function useGlbMaterialSwap(
  target: THREE.Object3D,
  material: THREE.Material | null,
  replaces: (current: THREE.Material) => boolean
): void {
  useEffect(() => {
    if (!material) return undefined;

    const restore: Array<() => void> = [];
    forEachSurfaceMaterial(target, (held, assign, read) => {
      const current = unfadedMaterial(held);
      if (!replaces(current)) return;
      assign(material);
      restore.push(() => {
        const now = read();
        if (now && unfadedMaterial(now) === material) assign(current);
      });
    });

    return () => restore.forEach((undo) => undo());
  }, [target, material, replaces]);
}

/** A node's own override takes every surface under its target. */
function everySurface(): boolean {
  return true;
}
