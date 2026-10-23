/**
 * The axis cross of Marker2D and Marker3D: for each axis a positive arm in the editor theme's axis
 * colour and a negative arm darkened by half, so the direction a node faces reads at a glance
 * (`marker_2d.cpp:47-59`, `marker_3d_gizmo_plugin.cpp:60-79`).
 */

import { godotColorToLinear } from '../godotColor';

type AxisName = 'x' | 'y' | 'z';

/** `axis_x_color`, `axis_y_color` and `axis_z_color` (`theme_classic.cpp:197-199`). */
const AXIS_COLORS = {
  x: { r: 0.96, g: 0.2, b: 0.32 },
  y: { r: 0.53, g: 0.84, b: 0.01 },
  z: { r: 0.16, g: 0.55, b: 0.96 },
};
const AXIS_DIRECTIONS = { x: [true, false, false], y: [false, true, false], z: [false, false, true] };
const NEGATIVE_ARM_DARKENING = 0.5;
const VERTICES_PER_AXIS = 4;

/** `Color::darkened` (`color.h:119`): the channels shrink by `amount`, before the linear convert. */
function darkened({ r, g, b }: { r: number; g: number; b: number }, amount: number) {
  return { r: r * (1 - amount), g: g * (1 - amount), b: b * (1 - amount) };
}

/**
 * Line-segment positions and per-vertex linear colours of the cross, four vertices per axis: the
 * positive arm from its tip to the origin, then the negative arm from the origin to its tip.
 */
export function axisCross(extents: number, axes: readonly AxisName[]) {
  const positions = new Float32Array(axes.length * VERTICES_PER_AXIS * 3);
  const colors = new Float32Array(positions.length);
  axes.forEach((axis, index) => {
    const onAxis = AXIS_DIRECTIONS[axis];
    const tips = [extents, 0, 0, -extents];
    const positive = godotColorToLinear(AXIS_COLORS[axis]);
    const negative = godotColorToLinear(darkened(AXIS_COLORS[axis], NEGATIVE_ARM_DARKENING));
    tips.forEach((distance, vertex) => {
      const offset = (index * VERTICES_PER_AXIS + vertex) * 3;
      positions.set(
        onAxis.map((isAxis) => (isAxis ? distance : 0)),
        offset
      );
      const color = vertex < 2 ? positive : negative;
      colors.set([color.r, color.g, color.b], offset);
    });
  });
  return { positions, colors };
}
