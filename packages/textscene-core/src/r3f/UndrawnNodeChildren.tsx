import { useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../parser/types.js';
import { joinPath } from '../utils/nodePath.js';
import { isViewportBoundary } from './viewportRender/viewportBoundary.js';
import { usePlaceViewport } from './contexts/ViewportPassRegistryContext.js';
import { childOrders, TreeOrderProvider, useTreeOrder } from './contexts/TreeOrderContext.js';
import { useCanvasWorkspace, type CanvasWorkspace } from './contexts/CanvasWorkspaceContext.js';
import { drawsBelowUndrawnParent } from './nodeWorkspaceVisibility.js';
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
        <UndrawnChild node={child} path={joinPath(path, child.name)} parentType={node.type} />
      </TreeOrderProvider>
    ) : null
  );
}

function UndrawnChild({ node, path, parentType }: UndrawnChildrenProps & { parentType: string }): ReactNode {
  const workspace = useCanvasWorkspace();
  if (isViewportBoundary(node.type)) return <ViewportPlacement path={path} />;
  if (!drawsBelowUndrawnParent(node, workspace)) return <UndrawnNodeChildren node={node} path={path} />;
  return (
    <ParentTypeProvider value={parentType}>
      <DispatchedNode node={node} path={path} />
    </ParentTypeProvider>
  );
}

/** A viewport's pass draws elsewhere, so it only takes its place in tree order here. */
function ViewportPlacement({ path }: { path: string }): null {
  usePlaceViewport(path);
  return null;
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
    (drawsBelowUndrawnParent(node, workspace) && !nodeComponentRegistry.passesThrough(node.type)) ||
    node.children.some((child) => reachesWorkspace(child, workspace));
  cache.set(node, reaches);
  return reaches;
}
