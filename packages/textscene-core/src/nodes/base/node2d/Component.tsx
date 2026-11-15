/** <Node2D>: an invisible 2D transform container. */

import type { Node2DProperties } from './types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { invisibleBase } from '../../../r3f/invisibleBase';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';

export function Node2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Node2DProperties;

  // A Node2D is the CanvasItem ritual with nothing of its own to draw: transform, z, visibility,
  // modulate and material context. Going through CanvasItem2D
  // keeps a Node2D container in step with whatever the ritual gains.
  return (
    <CanvasItem2D node={node} props={props}>
      {children}
    </CanvasItem2D>
  );
}

invisibleBase(Node2D);
