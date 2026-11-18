import { useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../parser/types.js';
import { joinPath } from '../utils/nodePath.js';
import { isViewportBoundary, isViewportSurface } from './viewportRender/viewportBoundary.js';
import { usePlaceViewport } from './contexts/ViewportPassRegistryContext.js';
import { childOrders, TreeOrderProvider, useTreeOrder } from './contexts/TreeOrderContext.js';
import { useCanvasWorkspace, type CanvasWorkspace } from './contexts/CanvasWorkspaceContext.js';
import { drawsInWorkspace } from './nodeWorkspaceVisibility.js';
import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import { ParentTypeProvider } from './parentSpaceScope.js';
import { DispatchedNode } from './NodeDispatcher.js';

interface UndrawnChildrenProps {
  node: TscnNode;
  path: string;
}

/** A drawn child starts clear of the undrawn `node` (`canvas_item.cpp:246-267`, `node_3d.cpp:150`). */
export function UndrawnNodeChildren({ node, path }: UndrawnChildrenProps): ReactNode {
  const workspace = useCanvasWorkspace();
  const order = useTreeOrder();
  const orders = useMemo(() => childOrders(order, node.children.length), [order, node.children.length]);
  return node.children.map((child, i) =>
    reachesWorkspace(child, workspace) ? (
      <TreeOrderProvider key={child.name} order={orders[i]!}>
        <ParentTypeProvider value={node.type}>
          <UndrawnChild node={child} path={joinPath(path, child.name)} />
        </ParentTypeProvider>
      </TreeOrderProvider>
    ) : null
  );
}

function UndrawnChild({ node, path }: UndrawnChildrenProps): ReactNode {
  const workspace = useCanvasWorkspace();
  const isViewport = isViewportBoundary(node.type);
  usePlaceViewport(isViewport ? path : null);
  if (isViewport) return null;
  if (isDispatched(node, workspace)) return <DispatchedNode node={node} path={path} />;
  return <UndrawnNodeChildren node={node} path={path} />;
}

/** A viewport surface stays undrawn: the Control walk mounts its pass. */
function isDispatched(node: TscnNode, workspace: CanvasWorkspace): boolean {
  return Boolean(node.instance) || (drawsInWorkspace(node.type, workspace) && !isViewportSurface(node.type));
}

/** Written only by {@link reachesWorkspace}. A parsed node is replaced, never changed. */
const reachCache: Record<CanvasWorkspace, WeakMap<TscnNode, boolean>> = {
  '2d': new WeakMap(),
  '3d': new WeakMap(),
};

/** Whether `workspace` draws or places `node` or a node below it. A container alone does not count. */
function reachesWorkspace(node: TscnNode, workspace: CanvasWorkspace): boolean {
  const cache = reachCache[workspace];
  const known = cache.get(node);
  if (known !== undefined) return known;
  const reaches =
    isViewportBoundary(node.type) ||
    (isDispatched(node, workspace) && !nodeComponentRegistry.passesThrough(node.type)) ||
    node.children.some((child) => reachesWorkspace(child, workspace));
  cache.set(node, reaches);
  return reaches;
}
