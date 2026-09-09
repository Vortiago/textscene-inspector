/**
 * Applies a `surface_material_override/0` to a GLB-internal mesh, with whatever
 * the `Ref<Material>` slot took: a `res://` material the pipeline loads, a scene
 * StandardMaterial3D built from its scalars, or the default shader for a
 * Material the previewer cannot build. A reference that does not load as a
 * Material never reaches here; the GLB keeps its own material.
 *
 * A glTF node with several primitives arrives as a Group of Meshes, so the
 * override applies to every mesh beneath the matched object, which is what
 * Godot's per-surface override means for a single-surface import.
 */

import { useEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { useResource } from '../../../resources/useResource.js';
import { StandardMaterialSlot } from '../../materials/StandardMaterialSlot.js';
import { scalarSlotFor, type MaterialSlotSource } from '../../materials/materialSlotSource.js';

export interface GlbSurfaceMaterialOverrideProps {
  /** The GLB-internal mesh whose material is being replaced. */
  target: THREE.Object3D;
  /** What the slot resolved to; see `resolveMaterialSlotSource`. */
  source: MaterialSlotSource;
}

export function GlbSurfaceMaterialOverride({ target, source }: GlbSurfaceMaterialOverrideProps) {
  return source.path ? (
    <GlbPathMaterialOverride target={target} path={source.path} />
  ) : (
    <GlbSlotMaterialOverride target={target} source={source} />
  );
}

/** Puts `material` on every mesh beneath `target`; returns the undo. */
function applyMaterial(target: THREE.Object3D, material: THREE.Material): () => void {
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
}

function GlbPathMaterialOverride({ target, path }: { target: THREE.Object3D; path: string }) {
  const material = useResource<THREE.Material>(path, 'material').value ?? null;
  useEffect(() => (material ? applyMaterial(target, material) : undefined), [target, material]);
  return null;
}

/**
 * The scene-material and default cases share `StandardMaterialSlot` with every
 * other renderer, so the same scalars draw the same material here. The slot
 * attaches to a hidden carrier mesh of this component's own; the effect runs
 * after that attach and hands the built material to the GLB meshes.
 */
function GlbSlotMaterialOverride({
  target,
  source,
}: {
  target: THREE.Object3D;
  source: MaterialSlotSource;
}) {
  const carrier = useRef<THREE.Mesh>(null);
  const { scalars } = useMemo(() => scalarSlotFor(source), [source]);
  useEffect(() => {
    const built = carrier.current?.material;
    const material = Array.isArray(built) ? built[0] : built;
    return material ? applyMaterial(target, material) : undefined;
  }, [target, scalars]);
  return (
    <mesh ref={carrier} visible={false}>
      <StandardMaterialSlot scalars={scalars} />
    </mesh>
  );
}
