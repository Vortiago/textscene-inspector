/**
 * <CanvasItem2D> — the shared CanvasItem ritual for 2D-canvas nodes: a named
 * <group> carrying the conjugated Node2D transform (see node2dTransform) with
 * the z_index draw-order offset, visibility, and the hierarchical modulate
 * context. The node's own pixels render through the `body` render-prop, which
 * receives the resolved linear-space tint (inherited modulate × self_modulate);
 * scene children render inside the inherited-modulate provider. Extracted from
 * the sprite slices (ADR-0006); TileMap/TileMapLayer are further consumers.
 */

import { useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../../parser/types';
import type { Node2DProperties } from '../../nodes/base/node2d/types';
import { node2dGroupProps, node2dGroupSpread, canvasItemZ } from '../node2dTransform';
import { Modulate2DContext, useCanvasItemTint, type CanvasItemTint } from '../canvasItemModulate';
import { useYSortZContext, useYSortSlot } from '../contexts/YSortContext';

export interface CanvasItem2DProps {
  node: TscnNode;
  props: Node2DProperties;
  /** Renders this node's own pixels with the resolved own-pixel tint. */
  body?: (tint: CanvasItemTint) => ReactNode;
  children?: ReactNode;
}

export function CanvasItem2D({ node, props, body, children }: CanvasItem2DProps) {
  const zSortZ = useYSortZContext();
  const slot = useYSortSlot();
  // When y-sort provides a rank-based z offset, use it directly — the tree-order slot
  // base is already baked into the enclosing y-sort group's z, so adding it here would
  // double-count. Otherwise (a leaf CanvasItem sitting directly in a tree-order slot,
  // e.g. a top-level TileMapLayer between two y-sort subtrees) shift by the slot base so
  // it lands in its slot rather than the shared layer base.
  const z = zSortZ !== null
    ? zSortZ
    : canvasItemZ(props) + slot.base;
  const transform = useMemo(
    () => node2dGroupSpread(node2dGroupProps(props, z)),
    [props, z]
  );
  const tint = useCanvasItemTint(props);

  return (
    <group name={node.name} {...transform} visible={props.visible !== false}>
      {body?.(tint)}
      <Modulate2DContext.Provider value={tint.inherited}>{children}</Modulate2DContext.Provider>
    </group>
  );
}
