/** <GrooveJoint2D> draws the groove and its offset bar for every node (`groove_joint_2d.cpp:46-49`). */

import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { JointNode } from '../shared/JointNode';
import { grooveMarker } from '../shared/jointStrokes';
import type { GrooveJoint2DProperties } from './types';

const strokesOf = ({ length, initial_offset }: GrooveJoint2DProperties) =>
  grooveMarker(length, initial_offset);

export function GrooveJoint2D({ node, children }: NodeComponentProps) {
  return (
    <JointNode node={node} strokesOf={strokesOf}>
      {children}
    </JointNode>
  );
}
