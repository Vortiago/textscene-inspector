/**
 * Each node's place in Godot's tree order, the pre-order walk in which nodes enter the tree. A
 * sub-scene that loads late still takes its place, which React's mount order cannot give.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { TreeOrder } from './treeOrder.js';

export {
  childEnterOrders,
  childOrders,
  compareReadyOrder,
  compareTreeOrder,
  type TreeOrder,
} from './treeOrder.js';

const SCENE_ROOT: TreeOrder = Object.freeze([]);

const TreeOrderContext = createContext<TreeOrder>(SCENE_ROOT);
TreeOrderContext.displayName = 'TreeOrderContext';

export function TreeOrderProvider({ order, children }: { order: TreeOrder; children: ReactNode }) {
  return <TreeOrderContext.Provider value={order}>{children}</TreeOrderContext.Provider>;
}

/** The enclosing node's place in tree order. Outside the dispatcher, every node ties at the root. */
export function useTreeOrder(): TreeOrder {
  return useContext(TreeOrderContext);
}
