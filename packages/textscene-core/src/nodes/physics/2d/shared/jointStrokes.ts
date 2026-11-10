/**
 * The editor marker of the 2D joints: the lines `PinJoint2D`, `GrooveJoint2D` and `DampedSpringJoint2D`
 * draw in their `NOTIFICATION_DRAW`, in Godot canvas pixels. The `frame` and `offset` styles are the
 * two looks Godot draws them in, which `JointMarker` holds.
 */

import type { Line2 } from '../../../../r3f/gizmo/thickLines';

export type JointStrokeStyle = 'frame' | 'offset';

export type JointStroke = Line2 & { style: JointStrokeStyle };

/** Half the 20 px bar every joint draws across its axis (`pin_joint_2d.cpp:45`). */
const BAR_HALF_LENGTH = 10;

const stroke = (style: JointStrokeStyle, fx: number, fy: number, tx: number, ty: number): JointStroke => ({
  style,
  from: { x: fx, y: fy },
  to: { x: tx, y: ty },
});

const bar = (style: JointStrokeStyle, y: number) => stroke(style, -BAR_HALF_LENGTH, y, BAR_HALF_LENGTH, y);

/** `pin_joint_2d.cpp:45-46`: two lines crossing at the origin. */
export function pinMarker(): JointStroke[] {
  return [bar('frame', 0), stroke('frame', 0, -BAR_HALF_LENGTH, 0, BAR_HALF_LENGTH)];
}

/** `damped_spring_joint_2d.cpp:46-48`: a bar at the origin and at `length`, and the line between. */
export function dampedSpringMarker(length: number): JointStroke[] {
  return [bar('frame', 0), bar('frame', length), stroke('frame', 0, 0, 0, length)];
}

/** `groove_joint_2d.cpp:46-49`: the spring marker, and a bar at `initialOffset`. */
export function grooveMarker(length: number, initialOffset: number): JointStroke[] {
  return [...dampedSpringMarker(length), bar('offset', initialOffset)];
}
