/**
 * Material slot for a StandardMaterial3D in an external `.tres`: it routes the
 * `res://` path through the material pipeline, textures and all. It draws Godot's
 * default 3D material while the load is pending or with no material, as Godot does.
 * One per surface, which keeps `useResource` one call per component.
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
  /** R3F attach key: `material` for a single surface, `material-N` for many. */
  attach?: string;
}

export function ExternalMaterialSlot({ path, attach }: ExternalMaterialSlotProps) {
  const result = useResource<THREE.Material>(path ?? '', 'material');
  if (path && result.value) {
    return <primitive object={result.value} attach={attach} />;
  }
  // `attach` comes off props but is not a program input, and every program
  // input here is a module constant, so this fallback never remounts.
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
