/**
 * Draws the instances of a tile layer's scene tiles after its authored children, each in the room
 * the node reserves behind them (`allocateNodePaintRange`), in the order of the cells.
 */

import { useMemo } from 'react';
import type { TscnNode } from '../../../../parser/types';
import { DispatchedNode } from '../../../../r3f/NodeDispatcher';
import { allocateNodePaintRange, allocatePaintRange } from '../../../../r3f/canvasPaintOrder';
import { PaintRangeProvider, usePaintRange } from '../../../../r3f/contexts/PaintOrderContext';
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
  const paintRange = usePaintRange();
  const order = useTreeOrder();
  const tail = useMemo(() => allocateNodePaintRange(paintRange, node).tail, [paintRange, node]);
  const ranges = useMemo(() => allocatePaintRange(tail, instances).children, [tail, instances]);
  // After the authored children in the tree, so the orders continue where theirs end.
  const orders = useMemo(
    () => childOrders(order, node.children.length + instances.length).slice(node.children.length),
    [order, node.children.length, instances.length]
  );

  return useMemo(
    () =>
      instances.map((instance, index) => (
        <PaintRangeProvider key={instance.name} value={ranges[index]!}>
          <TreeOrderProvider order={orders[index]!}>
            <DispatchedNode node={instance as LiveNode} path={joinPath(path, instance.name)} />
          </TreeOrderProvider>
        </PaintRangeProvider>
      )),
    [instances, ranges, orders, path]
  );
}
