/**
 * <Node2D> — invisible 2D transform container. Maps the Godot 2D transform
 * onto a <group> with z_index draw-order offset, and modulate context.
 *
 * When `y_sort_enabled` is true, children are NOT rendered directly.
 * Instead, <YSortDispatcher> collects them, sorts by (effectiveZ bucket →
 * world sortY → tree order), assigns rank-based z within each bucket,
 * and re-renders in that order.
 */

import type { Node2DProperties } from './types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { YSortDispatcher } from '../../../r3f/YSortDispatcher.js';

export function Node2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Node2DProperties;

  // A Node2D IS the CanvasItem ritual with nothing of its own to draw: same
  // transform, same z (including a y-sort rank when its parent hands one down),
  // same visibility, same modulate and material context for the subtree. Going
  // through CanvasItem2D rather than repeating it is what keeps a Node2D
  // container from silently missing whatever the ritual gains next.
  return (
    <CanvasItem2D node={node} props={props}>
      {props.y_sort_enabled ? <YSortDispatcher node={node}>{children}</YSortDispatcher> : children}
    </CanvasItem2D>
  );
}
