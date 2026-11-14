/**
 * Draws the instances of a tile layer's scene tiles after its authored children, each in the room
 * the node reserves behind them (its paint's `tail`), in the order of the cells. The instances are
 * outside the shared live tree, so each takes its run from here.
 */

import { useMemo } from 'react';
import type { TscnNode } from '../../../../parser/types';
import { DispatchedNode } from '../../../../r3f/NodeDispatcher';
import { contentFrames, PaintFrameProvider, useNodePaint } from '../../../../r3f/canvasItemPass/nodePaint';
import { childOrders, TreeOrderProvider, useTreeOrder } from '../../../../r3f/contexts/TreeOrderContext';
import { useNodePath } from '../../../../r3f/contexts/NodePathContext';
import type { LiveNode } from '../../../../resources/liveNode';
import { joinPath } from '../../../../utils/nodePath';

interface SceneTileInstancesProps {
  /** The node the instances are children of: the layer, or the TileMap. */
  node: TscnNode;
  instances: readonly TscnNode[];
}

export function SceneTileInstances({ node, instances }: SceneTileInstancesProps) {
  const path = useNodePath() ?? node.name;
  const { tail } = useNodePaint(node, path);
  const order = useTreeOrder();
  const frames = useMemo(() => contentFrames(tail, instances), [tail, instances]);
  // After the authored children in the tree, so the orders continue where theirs end.
  const orders = useMemo(
    () => childOrders(order, node.children.length + instances.length).slice(node.children.length),
    [order, node.children.length, instances.length]
  );

  return useMemo(
    () =>
      instances.map((instance, index) => (
        <PaintFrameProvider key={instance.name} value={frames[index]!}>
          <TreeOrderProvider order={orders[index]!}>
            <DispatchedNode node={instance as LiveNode} path={joinPath(path, instance.name)} />
          </TreeOrderProvider>
        </PaintFrameProvider>
      )),
    [instances, frames, orders, path]
  );
}
