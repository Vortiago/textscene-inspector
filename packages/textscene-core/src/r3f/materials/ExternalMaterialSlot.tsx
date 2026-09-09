/**
 * Material slot for a StandardMaterial3D that lives in an external `.tres`.
 *
 * `resolveStandardMaterial` only understands `SubResource("id")`, so a node
 * whose `material` is an `ExtResource` pointing at a `.tres` has no material
 * to parse and would fall through to Godot's default white. This slot routes
 * the resolved `res://` path through the material pipeline instead — textures
 * and all — and renders the default white only while the load is pending or
 * when there is genuinely no material.
 *
 * Shared by MeshInstance3D (one instance per ArrayMesh surface / draw group,
 * which also keeps the `useResource` calls one-per-component for an arbitrary
 * surface count) and by the CSG primitives.
 */

import * as THREE from 'three';
import { useResource } from '../../resources/useResource';

interface ExternalMaterialSlotProps {
  /** `res://` path to the `.tres`, or null for "no external material". */
  path: string | null;
  /** R3F attach key — `material` for a single surface, `material-N` for many. */
  attach?: string;
  shadowSide?: THREE.Side;
}

export function ExternalMaterialSlot({ path, attach, shadowSide }: ExternalMaterialSlotProps) {
  const result = useResource<THREE.Material>(path ?? '', 'material');
  if (path && result.value) {
    return <primitive object={result.value} attach={attach} />;
  }
  return (
    <meshStandardMaterial
      attach={attach}
      color={0xffffff}
      metalness={0}
      roughness={1}
      side={THREE.FrontSide}
      shadowSide={shadowSide ?? null}
    />
  );
}
