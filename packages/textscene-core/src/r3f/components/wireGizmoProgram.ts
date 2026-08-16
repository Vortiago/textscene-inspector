/**
 * The editor's wireframe-gizmo material, as one program.
 *
 * Every wire gizmo in the codebase — collision shapes, the GridMap placeholder
 * cell, MeshInstance3D's unresolved mesh, the AudioStreamPlayer3D speaker, the
 * missing-resource box — is the same two props, and each had re-derived them
 * beside `GIZMO_RENDER_ORDER` and the other shared gizmo pieces.
 *
 * `color` is a uniform, not a program input, so every gizmo shares one key
 * whatever colour it draws in.
 */
import type { ColorRepresentation } from 'three';
import { materialProgramInputs } from '../materialProgramInputs';

export const wireGizmoProgram = (color: ColorRepresentation) =>
  materialProgramInputs({ props: { color, wireframe: true } });
