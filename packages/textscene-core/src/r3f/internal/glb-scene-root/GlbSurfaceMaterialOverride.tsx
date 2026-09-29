/**
 * `surface_material_override/0` on a mesh inside a loaded GLB. Not in the pure, synchronous
 * `applyGlbNodeOverrides`: its material may load asynchronously, which React handles
 * declaratively.
 */

import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import { standardMaterialBag } from '../../../resources/materials/standardmaterial3d/materialBag.js';
import { materialFromBag } from '../../../resources/materials/standardmaterial3d/build.js';
import { textureSlotsFromMaps } from '../../materials/materialTextureMaps.js';
import { useMaterialScalars, useMaterialTextures } from '../../materials/SurfaceMaterialSlot.js';
import { useMaterial } from '../../materials/useMaterial.js';
import type { MaterialSource } from '../../materials/materialSource.js';

export interface GlbSurfaceMaterialOverrideProps {
  /** The GLB-internal mesh whose material is being replaced. */
  target: THREE.Object3D;
  /** Where the override material lives, already resolved. */
  source: MaterialSource;
}

/**
 * The override material, built and disposed here, whichever file it came from. Not
 * `<StandardMaterialSlot>`: the target is inside a cloned GLB with no R3F element. It shares
 * that slot's derivation, so the adapters stay two (ADR-0039). A material this previewer
 * cannot build still replaced the glTF's own, so the surface is Godot's default (ADR-0041).
 */
export function GlbSurfaceMaterialOverride({ target, source }: GlbSurfaceMaterialOverrideProps) {
  const loaded = useMaterial(source);
  const scalars = useMaterialScalars(loaded);
  // No `triplanarMesh`: the geometry is the glTF's, so there is no Godot mesh
  // sub-resource whose size a triplanar material could tile against.
  const { maps } = useMaterialTextures(scalars, loaded);
  const material = useMemo(
    () => materialFromBag(standardMaterialBag(scalars, textureSlotsFromMaps(maps))),
    [scalars, maps]
  );
  useEffect(() => () => material.dispose(), [material]);
  useGlbMaterialSwap(target, material);
  return null;
}

/**
 * Puts `material` on every mesh under `target`: a glTF node with several primitives arrives as a
 * Group of Meshes. Restores the old material on unmount, since the GLB clone is long-lived and a
 * reload that dropped the override would leave the swap behind.
 */
function useGlbMaterialSwap(target: THREE.Object3D, material: THREE.Material | null): void {
  useEffect(() => {
    if (!material) return undefined;

    const restore: Array<[THREE.Mesh, THREE.Material | THREE.Material[]]> = [];
    target.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      restore.push([mesh, mesh.material]);
      mesh.material = material;
    });

    return () => {
      for (const [mesh, previous] of restore) mesh.material = previous;
    };
  }, [target, material]);
}
