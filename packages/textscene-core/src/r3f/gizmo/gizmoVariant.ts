/**
 * The looks of a gizmo material. Godot's `create_material` builds a selected and an unselected
 * variant of every gizmo colour, and the unselected one multiplies the colour's alpha by 0.3
 * (`editor/scene/3d/node_3d_editor_gizmos.cpp:919-920`). It builds them again in one grey colour for a
 * node the edited scene does not own (`:907-917`).
 */

export type GizmoVariant = 'selected' | 'unselected';

const UNSELECTED_ALPHA_FACTOR = 0.3;

/**
 * The colour of every gizmo material of a node the edited scene does not own, which replaces the
 * colour and the alpha the gizmo plugin gave (`editor_settings.cpp:879`).
 */
export const INSTANTIATED_GIZMO_COLOUR = { r: 0.7, g: 0.7, b: 0.7, a: 0.6 };

/** The opacity of a gizmo part whose Godot colour has alpha `colourAlpha`, in `variant`. */
export function gizmoAlpha(variant: GizmoVariant, colourAlpha: number): number {
  return variant === 'unselected' ? colourAlpha * UNSELECTED_ALPHA_FACTOR : colourAlpha;
}
