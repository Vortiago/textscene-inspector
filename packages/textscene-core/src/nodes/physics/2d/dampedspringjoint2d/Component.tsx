/** <DampedSpringJoint2D> draws the spring axis for every node (`damped_spring_joint_2d.cpp:46-48`). */

import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { JointNode } from '../shared/JointNode';
import { dampedSpringMarker } from '../shared/jointStrokes';
import type { DampedSpringJoint2DProperties } from './types';

const strokesOf = ({ length }: DampedSpringJoint2DProperties) => dampedSpringMarker(length);

export function DampedSpringJoint2D({ node, children }: NodeComponentProps) {
  return (
    <JointNode node={node} strokesOf={strokesOf}>
      {children}
    </JointNode>
  );
}
