/**
 * Material slot for a StandardMaterial3D that lives in an external `.tres`.
 *
 * The half of `MaterialSource` a scene cannot describe: a `.tres` has no
 * `[sub_resource]` body to read, so there is nothing to parse here. This slot
 * routes the resolved `res://` path through the material pipeline instead —
 * textures and all — and falls back to Godot's default 3D material only while
 * the load is pending or when there is genuinely no material, which is the same
 * surface Godot itself draws in that case.
 *
 * Shared by MeshInstance3D (one instance per ArrayMesh surface / draw group,
 * which also keeps the `useResource` calls one-per-component for an arbitrary
 * surface count) and by the CSG primitives.
 */

import * as THREE from 'three';
import { useResource } from '../../resources/useResource';
import {
  GODOT_DEFAULT_ALBEDO,
  GODOT_DEFAULT_METALLIC,
  GODOT_DEFAULT_ROUGHNESS,
} from './godotDefaultMaterial';
import { materialProgramInputs } from '../materialProgramInputs';

interface ExternalMaterialSlotProps {
  /** `res://` path to the `.tres`, or null for "no external material". */
  path: string | null;
  /** R3F attach key — `material` for a single surface, `material-N` for many. */
  attach?: string;
}

export function ExternalMaterialSlot({ path, attach }: ExternalMaterialSlotProps) {
  const result = useResource<THREE.Material>(path ?? '', 'StandardMaterial3D');
  if (path && result.value) {
    return <primitive object={result.value} attach={attach} />;
  }
  // Not literal-only — `attach` comes off props — but it is not a program input,
  // and every one that IS here is a module constant, so the key is constant and
  // this fallback never remounts.
  const fallback = materialProgramInputs({
    props: {
      attach,
      color: GODOT_DEFAULT_ALBEDO,
      metalness: GODOT_DEFAULT_METALLIC,
      roughness: GODOT_DEFAULT_ROUGHNESS,
      side: THREE.FrontSide,
    },
  });
  return <meshStandardMaterial key={fallback.key} {...fallback.props} />;
}
