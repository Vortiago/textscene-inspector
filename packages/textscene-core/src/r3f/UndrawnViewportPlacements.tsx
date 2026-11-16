/**
 * Places the viewports below a node that this workspace does not draw, such as a Control in the 3D
 * workspace. Their passes still draw (a Control-only one mounts outside the node walk), so each
 * takes its place in tree order here, as a drawn one does in `NodeDispatcher`.
 */

import { useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../parser/types.js';
import { joinPath } from '../utils/nodePath.js';
import { isViewportBoundary } from './viewportRender/viewportBoundary.js';
import { usePlaceViewport } from './contexts/ViewportPassRegistryContext.js';
import { childOrders, TreeOrderProvider, useTreeOrder } from './contexts/TreeOrderContext.js';

interface UndrawnChildrenProps {
  node: TscnNode;
  path: string;
}

/** The children of the undrawn `node`, which sits at the caller's place in tree order. */
export function UndrawnViewportPlacements({ node, path }: UndrawnChildrenProps): ReactNode {
  const order = useTreeOrder();
  const orders = useMemo(() => childOrders(order, node.children.length), [order, node.children.length]);
  return node.children.map((child, i) =>
    holdsViewport(child) ? (
      <TreeOrderProvider key={child.name} order={orders[i]!}>
        <UndrawnNode node={child} path={joinPath(path, child.name)} />
      </TreeOrderProvider>
    ) : null
  );
}

/** A viewport places itself and stops: the viewports nested in it take their place from its pass. */
function UndrawnNode({ node, path }: UndrawnChildrenProps): ReactNode {
  const isViewport = isViewportBoundary(node.type);
  usePlaceViewport(isViewport ? path : null);
  return isViewport ? null : <UndrawnViewportPlacements node={node} path={path} />;
}

function holdsViewport(node: TscnNode): boolean {
  return isViewportBoundary(node.type) || node.children.some(holdsViewport);
}
