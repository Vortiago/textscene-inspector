/**
 * <Node2D> — invisible 2D transform container. Maps the Godot 2D transform
 * onto a <group> with z_index draw-order offset, and modulate context.
 *
 * When `y_sort_enabled` is true, children are NOT rendered directly.
 * Instead, <YSortDispatcher> collects them, sorts by (effectiveZ bucket →
 * world sortY → tree order), assigns rank-based z within each bucket,
 * and re-renders in that order.
 */

import { useMemo } from 'react';
import type { Node2DProperties } from './types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { node2dGroupProps, node2dGroupSpread, canvasItemZ } from '../../../r3f/node2dTransform';
import { Modulate2DContext, multiplyModulate, useParentModulate } from '../../../r3f/canvasItemModulate';
import { YSortDispatcher } from '../../../r3f/YSortDispatcher.js';
import { useYSortSlot, useYSortZContext } from '../../../r3f/contexts/YSortContext';

export function Node2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Node2DProperties;
  // A tree-order slot base (set by a non-y-sort ancestor that distributes its
  // z-band among y-sort subtrees) shifts this group's whole subtree into its slot.
  const slot = useYSortSlot();
  // When this Node2D is itself a y-sort item (its y-sort parent gave it a rank z via
  // context), that rank z IS its draw position — exactly as CanvasItem2D does — so a
  // Node2D-rooted unit sorts by its rank like a sprite sibling instead of ignoring it.
  const zSortZ = useYSortZContext();
  const z = zSortZ !== null ? zSortZ : canvasItemZ(props) + slot.base;
  const transform = useMemo(
    () => node2dGroupSpread(node2dGroupProps(props, z)),
    [props, z]
  );
  const visible = props.visible !== false;

  const parentModulate = useParentModulate();
  const modulate = useMemo(
    () => multiplyModulate(parentModulate, props.modulate),
    [parentModulate, props.modulate]
  );

  return (
    <group name={node.name} {...transform} visible={visible}>
      <Modulate2DContext.Provider value={modulate}>
        {props.y_sort_enabled
          ? <YSortDispatcher node={node} children={children} />
          : children
        }
      </Modulate2DContext.Provider>
    </group>
  );
}
