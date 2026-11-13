/**
 * The group a y-sorted TileMapLayer's rows share, which the layer's path registers. The rows are
 * child canvas items of the layer (`tile_map_layer.cpp:341-357`), so a track on the layer's
 * transform (ADR-0011) moves them all, and the live sort reads the layer's pose from this group
 * (ADR-0070). The rows draw below it at the identity.
 */

import { useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../parser/types.js';
import type { Node2DProperties } from '../nodes/base/node2d/types.js';
import { useNodeObjectRegistration } from './hooks/useNodeObjectRegistration.js';
import { useLiveDrawnNode } from './liveNodePatches.js';
import { node2dGroupPropsOf, node2dGroupSpread } from './node2dTransform.js';

export function YSortLayerGroup({
  node: authored,
  path,
  children,
}: {
  node: TscnNode;
  /** The layer's path in the scene, through the ancestors it was lifted past. */
  path: string;
  children: ReactNode;
}) {
  const node = useLiveDrawnNode(authored, path);
  const properties = node.properties as Partial<Node2DProperties>;
  const transform = useMemo(() => node2dGroupSpread(node2dGroupPropsOf(properties)), [properties]);
  const wrapperRef = useNodeObjectRegistration(path);

  return (
    // paint-order-safe: the layer's transform group, outside the rows' own groups, which
    // `<CanvasItem2D>` renders nearer to every mesh.
    <group ref={wrapperRef}>
      <group name={node.name} {...transform}>
        {children}
      </group>
    </group>
  );
}
