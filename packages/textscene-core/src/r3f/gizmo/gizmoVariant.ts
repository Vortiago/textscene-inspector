/**
 * The two looks of a gizmo material. Godot's `create_material` builds a selected and an unselected
 * variant of every gizmo colour, and the unselected one multiplies the colour's alpha by 0.3
 * (`editor/scene/3d/node_3d_editor_gizmos.cpp:919-920`).
 */

export type GizmoVariant = 'selected' | 'unselected';

const UNSELECTED_ALPHA_FACTOR = 0.3;

/** The opacity of a gizmo part whose Godot colour has alpha `colourAlpha`, in `variant`. */
export function gizmoAlpha(variant: GizmoVariant, colourAlpha = 1): number {
  return variant === 'unselected' ? colourAlpha * UNSELECTED_ALPHA_FACTOR : colourAlpha;
}
