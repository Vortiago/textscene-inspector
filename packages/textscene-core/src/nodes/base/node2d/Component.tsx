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

interface Node2DProps extends NodeComponentProps {
  zOverride?: number | null;
}

export function Node2D({ node, children, zOverride }: Node2DProps) {
  const props = node.properties as Node2DProperties;
  const z = zOverride !== undefined && zOverride !== null ? zOverride : canvasItemZ(props);
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
