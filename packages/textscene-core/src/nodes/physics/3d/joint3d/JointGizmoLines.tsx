/**
 * Joint3D gizmo lines in the colour of their part, each at opacity 1 as Godot's gizmo materials
 * have. The caller mounts them inside a `PluginGizmo`, which makes them faint while unselected.
 */

import { GizmoLine } from '../../../../r3f/components/GizmoLine';
import { godotColorToLinear } from '../../../../r3f/godotColor';

/** `editors/3d_gizmos/gizmo_colors/joint`, `joint_body_a` and `joint_body_b` (`editor_settings.cpp:880-890`). */
const PART_COLOURS = {
  joint: godotColorToLinear({ r: 0.5, g: 0.8, b: 1 }),
  bodyA: godotColorToLinear({ r: 0.6, g: 0.8, b: 1 }),
  bodyB: godotColorToLinear({ r: 0.6, g: 0.9, b: 1 }),
};

interface JointGizmoLinesProps {
  part: keyof typeof PART_COLOURS;
  /** Flat segment ends `[x0,y0,z0, x1,y1,z1, …]` in the joint's local frame. */
  positions: Float32Array;
}

export function JointGizmoLines({ part, positions }: JointGizmoLinesProps) {
  return <GizmoLine positions={positions} color={PART_COLOURS[part]} />;
}
