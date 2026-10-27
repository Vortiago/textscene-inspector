/**
 * The looks of a gizmo material. Godot's `create_material` builds a selected and an unselected
 * variant of every gizmo colour, and the unselected one multiplies the colour's alpha by 0.3
 * (`editor/scene/3d/node_3d_editor_gizmos.cpp:919-920`). It builds them again in one grey colour for a
 * node the edited scene does not own (`:907-917`). An icon material dims its colour, not its alpha
 * (`:949-962`).
 */

import type { Rgba } from '../../godot/math/math';

export type GizmoVariant = 'selected' | 'unselected';

const UNSELECTED_ALPHA_FACTOR = 0.3;
const UNSELECTED_ICON_COLOUR_FACTOR = 0.6;
const WHITE: Rgba = { r: 1, g: 1, b: 1, a: 1 };

/**
 * The colour of every gizmo material of a node the edited scene does not own, which replaces the
 * colour and the alpha the gizmo plugin gave (`editor_settings.cpp:879`).
 */
export const INSTANTIATED_GIZMO_COLOUR = { r: 0.7, g: 0.7, b: 0.7, a: 0.6 };

/** The opacity of a gizmo part whose Godot colour has alpha `colourAlpha`, in `variant`. */
export function gizmoAlpha(variant: GizmoVariant, colourAlpha: number): number {
  return variant === 'unselected' ? colourAlpha * UNSELECTED_ALPHA_FACTOR : colourAlpha;
}

/**
 * The albedo of a node icon's material: white, or the instantiated grey in a node the edited scene
 * does not own. An unselected icon multiplies the colour channels by 0.6 and keeps the alpha.
 */
export function iconAlbedo(variant: GizmoVariant, isInstantiated: boolean): Rgba {
  const albedo = isInstantiated ? INSTANTIATED_GIZMO_COLOUR : WHITE;
  if (variant === 'selected') return albedo;
  const dimmed = UNSELECTED_ICON_COLOUR_FACTOR;
  return { r: albedo.r * dimmed, g: albedo.g * dimmed, b: albedo.b * dimmed, a: albedo.a };
}
