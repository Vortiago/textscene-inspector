/** <PinJoint2D> draws two 20 px bars crossing at its origin for every node (`pin_joint_2d.cpp:45-46`). */

import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { JointNode } from '../shared/JointNode';
import { pinMarker } from '../shared/jointStrokes';

const PIN_STROKES = pinMarker();

export function PinJoint2D({ node, children }: NodeComponentProps) {
  return (
    <JointNode node={node} strokes={PIN_STROKES}>
      {children}
    </JointNode>
  );
}
