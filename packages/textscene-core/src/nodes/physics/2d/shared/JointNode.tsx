/** A 2D joint node: a Node2D group that draws its editor marker for every node. */

import { useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../../../../parser/types';
import { Node2D } from '../../../base/node2d/Component';
import { JointMarker } from './JointMarker';
import type { JointStrokes } from './jointStrokes';

export function JointNode<Properties>({
  node,
  strokesOf,
  children,
}: {
  node: TscnNode;
  /** A stable function: it keys the memo of the marker's geometry. */
  strokesOf: (properties: Properties) => JointStrokes;
  children?: ReactNode;
}) {
  const strokes = useMemo(() => strokesOf(node.properties as Properties), [strokesOf, node.properties]);
  return (
    <Node2D node={node}>
      <JointMarker strokes={strokes} />
      {children}
    </Node2D>
  );
}
