/**
 * What a node icon's material draws with. Godot multiplies the albedo by the vertex colour that
 * carries the light tint, and converts both from sRGB (`node_3d_editor_gizmos.cpp:949-962`).
 */

import type * as THREE from 'three';
import type { Rgba } from '../../godot/math/math';
import { godotColorToLinear } from '../godotColor';
import { iconAlbedo, type GizmoVariant } from '../gizmo/gizmoVariant';

interface IconAppearance {
  color: THREE.Color;
  /** The alpha the scissor tests; the icon blends nothing. */
  opacity: number;
}

export function iconAppearance(
  variant: GizmoVariant,
  isInstantiated: boolean,
  modulate: Rgba
): IconAppearance {
  const albedo = iconAlbedo(variant, isInstantiated);
  return {
    color: godotColorToLinear(albedo).multiply(godotColorToLinear(modulate)),
    opacity: albedo.a * modulate.a,
  };
}
