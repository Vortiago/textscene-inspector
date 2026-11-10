/** A 2D joint node: a Node2D group that draws its editor marker for every node. */

import type { ReactNode } from 'react';
import type { TscnNode } from '../../../../parser/types';
import { Node2D } from '../../../base/node2d/Component';
import { JointMarker } from './JointMarker';
import type { JointStroke } from './jointStrokes';

export function JointNode({
  node,
  strokes,
  children,
}: {
  node: TscnNode;
  strokes: readonly JointStroke[];
  children?: ReactNode;
}) {
  return (
    <Node2D node={node}>
      <JointMarker strokes={strokes} />
      {children}
    </Node2D>
  );
}
