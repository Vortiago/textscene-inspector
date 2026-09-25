/**
 * <Node2D>: an invisible 2D transform container. With `y_sort_enabled`, <YSortDispatcher> renders
 * the children, sorted by effective-z bucket, then world sortY, then tree order, with rank-based z
 * within each bucket.
 */

import type { Node2DProperties } from './types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { YSortDispatcher } from '../../../r3f/YSortDispatcher.js';

export function Node2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Node2DProperties;

  // A Node2D is the CanvasItem ritual with nothing of its own to draw: transform, z (with a y-sort
  // rank from its parent), visibility, modulate and material context. Going through CanvasItem2D
  // keeps a Node2D container in step with whatever the ritual gains.
  return (
    <CanvasItem2D node={node} props={props}>
      {props.y_sort_enabled ? <YSortDispatcher node={node}>{children}</YSortDispatcher> : children}
    </CanvasItem2D>
  );
}
