/** <PinJoint2D>: a Node2D group that draws Godot's pin cross for every node (`pin_joint_2d.cpp:45-46`). */

import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../../base/node2d/Component';
import { JointMarker } from '../shared/JointMarker';
import { pinMarker } from '../shared/jointStrokes';

const PIN_STROKES = pinMarker();

export function PinJoint2D({ node, children }: NodeComponentProps) {
  return (
    <Node2D node={node}>
      <JointMarker strokes={PIN_STROKES} />
      {children}
    </Node2D>
  );
}
