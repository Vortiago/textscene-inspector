/**
 * Draws the instances a tile layer adds for its scene tiles, after its authored children, in the
 * order of the cells. Each is a child of the layer in the live tree, so it reads its paint by path.
 */

import { useMemo } from 'react';
import type { TscnNode } from '../../../../parser/types';
import { DispatchedNode } from '../../../../r3f/NodeDispatcher';
import { childOrders, TreeOrderProvider, useTreeOrder } from '../../../../r3f/contexts/TreeOrderContext';
import { useNodePath } from '../../../../r3f/contexts/NodePathContext';
import { joinPath } from '../../../../utils/nodePath';

interface SceneTileInstancesProps {
  /** The node the instances are children of: the layer, or the TileMap. */
  node: TscnNode;
  instances: readonly TscnNode[];
}

export function SceneTileInstances({ node, instances }: SceneTileInstancesProps) {
  const path = useNodePath() ?? node.name;
  const order = useTreeOrder();
  // After the authored children in the tree, so the orders continue where theirs end.
  const orders = useMemo(
    () => childOrders(order, node.children.length + instances.length).slice(node.children.length),
    [order, node.children.length, instances.length]
  );

  return useMemo(
    () =>
      instances.map((instance, index) => (
        <TreeOrderProvider key={instance.name} order={orders[index]!}>
          <DispatchedNode node={instance} path={joinPath(path, instance.name)} />
        </TreeOrderProvider>
      )),
    [instances, orders, path]
  );
}
