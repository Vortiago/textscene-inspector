/**
 * Draws the layers of a TileMap that is not y-sorted, before its authored children, as Godot adds
 * each as an internal front child (`tile_map.cpp:277-279`). Each layer is a child of the TileMap in
 * the live tree, so it reads its paint by path.
 */

import { useMemo } from 'react';
import type { TscnNode } from '../../../../parser/types';
import { DispatchedNode } from '../../../../r3f/NodeDispatcher';
import { TreeOrderProvider, useTreeOrder } from '../../../../r3f/contexts/TreeOrderContext';
import { useNodePath } from '../../../../r3f/contexts/NodePathContext';
import { tileMapLayerChildren } from '../../../../r3f/liveTileMapLayers';
import { joinPath } from '../../../../utils/nodePath';

export function TileMapLayers({ node }: { node: TscnNode }) {
  const path = useNodePath() ?? node.name;
  const order = useTreeOrder();
  return useMemo(() => {
    const layers = tileMapLayerChildren(node) ?? [];
    return layers.map((layer, index) => (
      // Before the authored children, whose orders start at 0.
      <TreeOrderProvider key={layer.name} order={[...order, index - layers.length]}>
        <DispatchedNode node={layer} path={joinPath(path, layer.name)} />
      </TreeOrderProvider>
    ));
  }, [node, order, path]);
}
