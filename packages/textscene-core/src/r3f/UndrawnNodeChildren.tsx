import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../parser/types.js';
import { joinPath } from '../utils/nodePath.js';
import { isViewportBoundary } from './viewportRender/viewportBoundary.js';
import { usePlaceViewport } from './contexts/ViewportPassRegistryContext.js';
import { childEnterOrders, TreeOrderProvider, useTreeOrder } from './contexts/TreeOrderContext.js';
import { useCanvasWorkspace, type CanvasWorkspace } from './contexts/CanvasWorkspaceContext.js';
import { drawsBelowUndrawnParent } from './nodeWorkspaceVisibility.js';
import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import { ParentTypeProvider } from './parentSpaceScope.js';
import { DispatchedNode, InPaintFrame } from './NodeDispatcher.js';
import { is2DUIType } from './controls/has2DUIContent.js';
import { perObject } from '../utils/perObject.js';
import type { ChildPaintFrames } from './canvasItemPass/nodePaint.js';

interface UndrawnChildrenProps {
  node: TscnNode;
  path: string;
  /** The frames `PlainNode` made for the children, absent below a second undrawn level. */
  frames?: ChildPaintFrames | null;
}

/** A drawn child starts clear of the undrawn `node` (`canvas_item.cpp:246-267`, `node_3d.cpp:150`). */
export function UndrawnNodeChildren({ node, path, frames }: UndrawnChildrenProps): ReactNode {
  const workspace = useCanvasWorkspace();
  const order = useTreeOrder();
  const orders = useMemo(() => childEnterOrders(order, node.children), [order, node.children]);
  const isBelowControl = useIsBelowControl() || is2DUIType(node.type);
  return (
    <BelowControlContext.Provider value={isBelowControl}>
      {node.children.map((child, i) =>
        reachesWorkspace(child, workspace) ? (
          <InPaintFrame key={child.name} frame={frames?.children[i]}>
            <TreeOrderProvider order={orders[i]!}>
              <UndrawnChild node={child} path={joinPath(path, child.name)} parentType={node.type} />
            </TreeOrderProvider>
          </InPaintFrame>
        ) : null
      )}
    </BelowControlContext.Provider>
  );
}

/** Whether an undrawn Control is above: the Control walk then mounts the pass of a viewport below. */
const BelowControlContext = createContext(false);

function useIsBelowControl(): boolean {
  return useContext(BelowControlContext);
}

function UndrawnChild({ node, path, parentType }: UndrawnChildrenProps & { parentType: string }): ReactNode {
  const workspace = useCanvasWorkspace();
  const isBelowControl = useIsBelowControl();
  const isViewport = isViewportBoundary(node.type);
  if (isViewport && isBelowControl) return <ViewportPlacement path={path} />;
  if (!isViewport && !drawsContent(node, workspace)) return <UndrawnNodeChildren node={node} path={path} />;
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

/** A slice that registers after a walk changes what a type draws, so the answers build again. */
const registryStamp = { stamp: () => nodeComponentRegistry.version };
const reaches2D = perObject((node: TscnNode) => reaches(node, '2d'), registryStamp);
const reaches3D = perObject((node: TscnNode) => reaches(node, '3d'), registryStamp);
const content2D = perObject((node: TscnNode) => holdsContent(node, '2d'), registryStamp);
const content3D = perObject((node: TscnNode) => holdsContent(node, '3d'), registryStamp);

function reachesWorkspace(node: TscnNode, workspace: CanvasWorkspace): boolean {
  return workspace === '2d' ? reaches2D(node) : reaches3D(node);
}

/** Whether `workspace` draws a node at or below `node` that is no container and no viewport. */
function drawsContent(node: TscnNode, workspace: CanvasWorkspace): boolean {
  return workspace === '2d' ? content2D(node) : content3D(node);
}

function reaches(node: TscnNode, workspace: CanvasWorkspace): boolean {
  return (
    isViewportBoundary(node.type) ||
    drawsContent(node, workspace) ||
    node.children.some((child) => reachesWorkspace(child, workspace))
  );
}

/** An instance counts: it parses as `Node` until its scene merges. */
function holdsContent(node: TscnNode, workspace: CanvasWorkspace): boolean {
  if (node.instance !== undefined || isViewportBoundary(node.type)) return node.instance !== undefined;
  const isOwnContent =
    drawsBelowUndrawnParent(node, workspace) && !nodeComponentRegistry.passesThrough(node.type);
  return isOwnContent || node.children.some((child) => drawsContent(child, workspace));
}
