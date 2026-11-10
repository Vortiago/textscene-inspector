/**
 * The editor marker of the 2D joints: the lines `PinJoint2D`, `GrooveJoint2D` and `DampedSpringJoint2D`
 * draw in their `NOTIFICATION_DRAW`, in Godot canvas pixels. `frame` strokes are 3 px wide in
 * `Color(0.7, 0.6, 0, 0.5)`, `offset` strokes 5 px wide in `Color(0.8, 0.8, 0.9, 0.5)`.
 */

import type { Vector2 } from '../../../../godot/math/vector';

export type JointStrokeStyle = 'frame' | 'offset';

export interface JointStroke {
  style: JointStrokeStyle;
  from: Vector2;
  to: Vector2;
}

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
