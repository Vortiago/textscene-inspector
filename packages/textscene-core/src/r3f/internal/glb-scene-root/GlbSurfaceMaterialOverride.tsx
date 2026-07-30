/**
 * `surface_material_override/0` applied to a mesh INSIDE a loaded GLB.
 *
 * This cannot live in `applyGlbNodeOverrides` and it is not an oversight that it
 * doesn't: that function is pure, synchronous and mutation-only, with no loader
 * and no resource table, while this needs an `ExtResource` resolved against the
 * OUTER scene and an async `.tres` load. Done declaratively instead, so the
 * async case falls out of React rather than needing a bespoke deferral — the
 * same shape `ExternalMaterialSlot` uses for an ordinary MeshInstance3D.
 *
 * Godot's town scene is the case: `town_scene.tscn` retextures the glTF town's
 * terrain, roads and racetrack through four such overrides, and without them the
 * whole landscape renders in the glTF's own materials.
 *
 * The previous material is restored on unmount, because the GLB clone is
 * per-consumer but long-lived — a scene reload that dropped the override would
 * otherwise leave the swapped material behind.
 */

import { useEffect } from 'react';
import type * as THREE from 'three';
import { useResource } from '../../../resources/useResource.js';

export interface GlbSurfaceMaterialOverrideProps {
  /** The GLB-internal mesh whose material is being replaced. */
  target: THREE.Object3D;
  /** Resolved `res://` path of the material resource. */
  path: string;
}

export function GlbSurfaceMaterialOverride({ target, path }: GlbSurfaceMaterialOverrideProps) {
  const result = useResource<THREE.Material>(path, 'StandardMaterial3D');
  const material = result.value ?? null;

  useEffect(() => {
    if (!material) return undefined;

    // A glTF node with several primitives arrives as a Group of Meshes, so the
    // override applies to every mesh beneath the matched object — which is what
    // Godot's per-surface override means for a single-surface import.
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

  return null;
}
