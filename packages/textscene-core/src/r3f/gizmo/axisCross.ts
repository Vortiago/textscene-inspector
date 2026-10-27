/**
 * The axis cross of Marker2D and Marker3D: for each axis a positive arm in the editor theme's axis
 * colour and a negative arm darkened by half, so the direction a node faces reads at a glance
 * (`marker_2d.cpp:47-59`, `marker_3d_gizmo_plugin.cpp:60-79`).
 */

import { darkened } from '../../godot/math/color';
import { Vector3Axis } from '../../godot/math/vector3Axis';
import { godotColorToLinear } from '../godotColor';

type Axis = (typeof Vector3Axis)[keyof typeof Vector3Axis];

/** `axis_x_color`, `axis_y_color` and `axis_z_color` (`theme_classic.cpp:197-199`). */
const AXIS_COLORS = [
  { r: 0.96, g: 0.2, b: 0.32 },
  { r: 0.53, g: 0.84, b: 0.01 },
  { r: 0.16, g: 0.55, b: 0.96 },
];
const NEGATIVE_ARM_DARKENING = 0.5;
export const FLOATS_PER_VERTEX = 3;
const VERTICES_PER_AXIS = 4;

/**
 * The linear colour of the four vertices of each axis: the positive arm, then the negative arm.
 * The negative arm darkens in sRGB, before the linear convert.
 */
const AXIS_VERTEX_COLORS = AXIS_COLORS.map((axisColor) => {
  const positive = godotColorToLinear(axisColor);
  const negative = godotColorToLinear(darkened(axisColor, NEGATIVE_ARM_DARKENING));
  return [positive, positive, negative, negative].flatMap(({ r, g, b }) => [r, g, b]);
});

/**
 * Line-segment positions and per-vertex linear colours of the cross, four vertices per axis: the
 * positive arm from its tip to the origin, then the negative arm from the origin to its tip.
 */
export function axisCross(extents: number, axes: readonly Axis[]) {
  const floatsPerAxis = VERTICES_PER_AXIS * FLOATS_PER_VERTEX;
  const positions = new Float32Array(axes.length * floatsPerAxis);
  const colors = new Float32Array(positions.length);
  const tipDistances = [extents, 0, 0, -extents];
  axes.forEach((axis, index) => {
    colors.set(AXIS_VERTEX_COLORS[axis]!, index * floatsPerAxis);
    tipDistances.forEach((distance, vertex) => {
      positions[index * floatsPerAxis + vertex * FLOATS_PER_VERTEX + axis] = distance;
    });
  });
  return { positions, colors };
}
