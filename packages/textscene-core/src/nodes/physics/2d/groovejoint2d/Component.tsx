/**
 * <GrooveJoint2D>: a Node2D group that draws the groove and its offset bar for every node
 * (`groove_joint_2d.cpp:46-49`).
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../../base/node2d/Component';
import { JointMarker } from '../shared/JointMarker';
import { grooveMarker } from '../shared/jointStrokes';
import type { GrooveJoint2DProperties } from './types';

export function GrooveJoint2D({ node, children }: NodeComponentProps) {
  const { length, initial_offset } = node.properties as GrooveJoint2DProperties;
  const strokes = useMemo(() => grooveMarker(length, initial_offset), [length, initial_offset]);
  return (
    <Node2D node={node}>
      <JointMarker strokes={strokes} />
      {children}
    </Node2D>
  );
}
