/**
 * Draws the internal children Godot adds to a tile node: a TileMap's layers before its authored
 * children (`tile_map.cpp:277-279`), and a layer's scene tile instances after them
 * (`tile_map_layer.cpp:1646`). Each is a child of the node in the live tree, so it reads its paint
 * by path.
 */

import { useMemo } from 'react';
import type { TscnNode } from '../../../../parser/types';
import { DispatchedNode } from '../../../../r3f/NodeDispatcher';
import {
  childOrders,
  TreeOrderProvider,
  useTreeOrder,
  type TreeOrder,
} from '../../../../r3f/contexts/TreeOrderContext';
import { useNodePath } from '../../../../r3f/contexts/NodePathContext';
import { joinPath } from '../../../../utils/nodePath';

interface InternalChildrenProps {
  /** The node the children belong to. */
  node: TscnNode;
  internals: readonly TscnNode[];
}

/** The children Godot adds with `INTERNAL_MODE_FRONT`, in tree order before the authored ones. */
export function FrontChildren({ node, internals }: InternalChildrenProps) {
  const order = useTreeOrder();
  // The authored children's orders start at 0, so these take the negative ones before them.
  const orders = useMemo(
    () => internals.map((_, index) => [...order, index - internals.length]),
    [order, internals]
  );
  return <DispatchedChildren node={node} internals={internals} orders={orders} />;
}

/** The children Godot appends after the authored ones, in tree order after them. */
export function TailChildren({ node, internals }: InternalChildrenProps) {
  const order = useTreeOrder();
  const orders = useMemo(
    () => childOrders(order, node.children.length + internals.length).slice(node.children.length),
    [order, node.children.length, internals.length]
  );
  return <DispatchedChildren node={node} internals={internals} orders={orders} />;
}

function DispatchedChildren({ node, internals, orders }: InternalChildrenProps & { orders: TreeOrder[] }) {
  const path = useNodePath() ?? node.name;
  return useMemo(
    () =>
      internals.map((child, index) => (
        <TreeOrderProvider key={child.name} order={orders[index]!}>
          <DispatchedNode node={child} path={joinPath(path, child.name)} />
        </TreeOrderProvider>
      )),
    [internals, orders, path]
  );
}
