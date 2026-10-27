/**
 * What a node icon's material draws with. Godot multiplies the albedo by the vertex colour that
 * carries the light tint, and converts both from sRGB (`node_3d_editor_gizmos.cpp:949-962`).
 */

import type * as THREE from 'three';
import type { Rgba } from '../../godot/math/math';
import { godotColorToLinear } from '../godotColor';
import { INSTANTIATED_GIZMO_COLOUR, type GizmoVariant } from '../gizmo/gizmoVariant';

interface IconAppearance {
  color: THREE.Color;
  /** The alpha the scissor tests; the icon blends nothing. */
  opacity: number;
}

const WHITE: Rgba = { r: 1, g: 1, b: 1, a: 1 };

/** An unselected icon multiplies the colour channels by 0.6 and keeps the alpha (`:962-965`). */
const UNSELECTED_COLOUR_FACTOR = 0.6;

/** White, or the instantiated grey in a node the edited scene does not own, dimmed when unselected. */
function iconAlbedo(variant: GizmoVariant, isInstantiated: boolean): Rgba {
  const albedo = isInstantiated ? INSTANTIATED_GIZMO_COLOUR : WHITE;
  if (variant === 'selected') return albedo;
  const dimmed = UNSELECTED_COLOUR_FACTOR;
  return { r: albedo.r * dimmed, g: albedo.g * dimmed, b: albedo.b * dimmed, a: albedo.a };
}

/** `modulate` is the vertex colour of the quad, white for a node that tints nothing. */
export function iconAppearance(
  variant: GizmoVariant,
  isInstantiated: boolean,
  modulate: Rgba = WHITE
): IconAppearance {
  const albedo = iconAlbedo(variant, isInstantiated);
  return {
    color: godotColorToLinear(albedo).multiply(godotColorToLinear(modulate)),
    opacity: albedo.a * modulate.a,
  };
}
