/**
 * The editor's wireframe-gizmo material, as one program that every wire gizmo
 * shares. `color` is a uniform, not a program input, so every gizmo shares one
 * key whatever colour it draws in.
 */
import type { ColorRepresentation } from 'three';
import { materialProgramInputs } from '../materialProgramInputs';

export const wireGizmoProgram = (color: ColorRepresentation) =>
  materialProgramInputs({ props: { color, wireframe: true } });
