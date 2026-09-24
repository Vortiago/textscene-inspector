/**
 * `surface_material_override/0` on a mesh inside a loaded GLB. Not in the pure, synchronous
 * `applyGlbNodeOverrides`: this resolves a reference against the outer scene and loads a `.tres`
 * asynchronously, which React handles declaratively.
 */

import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types.js';
import { useResource } from '../../../resources/useResource.js';
import { parseStandardMaterial3DScalars } from '../../../resources/materials/standardmaterial3d/scalars.js';
import { standardMaterialBag } from '../../../resources/materials/standardmaterial3d/materialBag.js';
import { materialFromBag } from '../../../resources/materials/standardmaterial3d/build.js';
import { textureSlotsFromMaps } from '../../materials/materialTextureMaps.js';
import { useMaterialTextures } from '../../materials/SurfaceMaterialSlot.js';
import type { MaterialSource } from '../../materials/materialSource.js';

export interface GlbSurfaceMaterialOverrideProps {
  /** The GLB-internal mesh whose material is being replaced. */
  target: THREE.Object3D;
  /** Where the override material lives, already resolved. */
  source: MaterialSource;
}

export function GlbSurfaceMaterialOverride({ target, source }: GlbSurfaceMaterialOverrideProps) {
  // Split rather than branched inline: each arrival calls its own hooks, and a
  // reference that changes kind remounts, which is what disposes the old one.
  if (source.kind === 'path') return <ExternalGlbMaterialOverride target={target} path={source.path} />;
  // An override that resolved to nothing buildable still replaced the glTF's own material, so
  // the surface is Godot's default (ADR-0041).
  if (source.kind === 'default') return <DefaultGlbMaterialOverride target={target} />;
  return <SceneGlbMaterialOverride target={target} resource={source.resource} />;
}

/** Godot's default 3D surface, built and disposed here like any scene material. */
function DefaultGlbMaterialOverride({ target }: { target: THREE.Object3D }) {
  const material = useMemo(() => materialFromBag(standardMaterialBag(null, {})), []);
  useEffect(() => () => material.dispose(), [material]);
  useGlbMaterialSwap(target, material);
  return null;
}

/** A `.tres` the material pipeline builds and owns, so it is never disposed here. */
function ExternalGlbMaterialOverride({ target, path }: { target: THREE.Object3D; path: string }) {
  const result = useResource<THREE.Material>(path, 'material');
  useGlbMaterialSwap(target, result.value ?? null);
  return null;
}

/**
 * A `[sub_resource]` of the scene, built and disposed here. Not `<StandardMaterialSlot>`: the
 * target is inside a cloned GLB with no R3F element. It shares that slot's derivation, so the
 * adapters stay two (ADR-0039).
 */
function SceneGlbMaterialOverride({
  target,
  resource,
}: {
  target: THREE.Object3D;
  resource: TscnInternalResource;
}) {
  const scalars = useMemo(
    () => parseStandardMaterial3DScalars(resource.data as Record<string, string>),
    [resource]
  );
  // No `triplanarMesh`: the geometry is the glTF's, so there is no Godot mesh
  // sub-resource whose size a triplanar material could tile against.
  const { maps } = useMaterialTextures(scalars);
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
