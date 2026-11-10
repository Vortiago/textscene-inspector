/**
 * The editor marker of the 2D joints: the lines `PinJoint2D`, `GrooveJoint2D` and `DampedSpringJoint2D`
 * draw in their `NOTIFICATION_DRAW`, in Godot canvas pixels. The `frame` and `offset` lists are the
 * two looks Godot draws them in, which `JointMarker` holds.
 */

import type { Line2 } from '../../../../r3f/gizmo/thickLines';

export interface JointStrokes {
  frame: Line2[];
  offset: Line2[];
}

/** Half the 20 px bar every joint draws across its axis (`pin_joint_2d.cpp:45`). */
const BAR_HALF_LENGTH = 10;

const line = (fx: number, fy: number, tx: number, ty: number): Line2 => ({
  from: { x: fx, y: fy },
  to: { x: tx, y: ty },
});

const bar = (y: number) => line(-BAR_HALF_LENGTH, y, BAR_HALF_LENGTH, y);

/** `pin_joint_2d.cpp:45-46`: two lines crossing at the origin. */
export function pinMarker(): JointStrokes {
  return { frame: [bar(0), line(0, -BAR_HALF_LENGTH, 0, BAR_HALF_LENGTH)], offset: [] };
}

/** A bar at the origin and at `length`, and the line between (`damped_spring_joint_2d.cpp:46-48`). */
const axis = (length: number): Line2[] => [bar(0), bar(length), line(0, 0, 0, length)];

export function dampedSpringMarker(length: number): JointStrokes {
  return { frame: axis(length), offset: [] };
}

/** `groove_joint_2d.cpp:46-49`: the spring marker, and a bar at `initialOffset`. */
export function grooveMarker(length: number, initialOffset: number): JointStrokes {
  return { frame: axis(length), offset: [bar(initialOffset)] };
}
