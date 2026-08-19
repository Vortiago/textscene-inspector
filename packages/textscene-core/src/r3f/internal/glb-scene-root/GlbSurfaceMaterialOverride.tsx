/**
 * `surface_material_override/0` applied to a mesh INSIDE a loaded GLB.
 *
 * This cannot live in `applyGlbNodeOverrides` and it is not an oversight that it
 * doesn't: that function is pure, synchronous and mutation-only, with no loader
 * and no resource table, while this needs a reference resolved against the OUTER
 * scene and, for the `.tres` arrival, an async load. Done declaratively instead,
 * so the async case falls out of React rather than needing a bespoke deferral.
 *
 * BOTH arrivals of the reference land here. A `[sub_resource]` of the scene is
 * built imperatively rather than through `<StandardMaterialSlot>` because the
 * target is deep inside a cloned GLB object graph, with no R3F element to attach
 * a material to — but it goes through the same derivation, so the two adapters
 * stay two (ADR-0039) rather than becoming three.
 *
 * Godot's town scene is the case: `town_scene.tscn` retextures the glTF town's
 * terrain, roads and racetrack through four such overrides, and without them the
 * whole landscape renders in the glTF's own materials.
 *
 * The previous material is restored on unmount, because the GLB clone is
 * per-consumer but long-lived — a scene reload that dropped the override would
 * otherwise leave the swapped material behind.
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
  return source.kind === 'path' ? (
    <ExternalGlbMaterialOverride target={target} path={source.path} />
  ) : (
    <SceneGlbMaterialOverride target={target} resource={source.resource} />
  );
}

/** A `.tres` the material pipeline builds and owns — never disposed here. */
function ExternalGlbMaterialOverride({ target, path }: { target: THREE.Object3D; path: string }) {
  const result = useResource<THREE.Material>(path, 'StandardMaterial3D');
  useGlbMaterialSwap(target, result.value ?? null);
  return null;
}

/** A `[sub_resource]` of the scene, built here — and therefore disposed here. */
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
 * Put `material` on every mesh under `target`, restoring what was there when it
 * goes away.
 *
 * A glTF node with several primitives arrives as a Group of Meshes, so the
 * override applies to every mesh beneath the matched object — which is what
 * Godot's per-surface override means for a single-surface import.
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
