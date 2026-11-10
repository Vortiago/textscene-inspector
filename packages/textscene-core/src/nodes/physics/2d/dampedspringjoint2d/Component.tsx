/** <DampedSpringJoint2D> draws the spring axis for every node (`damped_spring_joint_2d.cpp:46-48`). */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { JointNode } from '../shared/JointNode';
import { dampedSpringMarker } from '../shared/jointStrokes';
import type { DampedSpringJoint2DProperties } from './types';

export function DampedSpringJoint2D({ node, children }: NodeComponentProps) {
  const { length } = node.properties as DampedSpringJoint2DProperties;
  const strokes = useMemo(() => dampedSpringMarker(length), [length]);
  return (
    <JointNode node={node} strokes={strokes}>
      {children}
    </JointNode>
  );
}
