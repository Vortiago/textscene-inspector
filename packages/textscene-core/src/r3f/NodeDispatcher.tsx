/**
 * Recursive walker that turns a parsed SceneGraph into a React tree.
 *
 * For each TscnNode in the scene's root list:
 *   1. Look up `nodeComponentRegistry.get(node.type)`.
 *   2. If a component is registered, render it with the node's pre-walked
 *      children passed as `children`.
 *   3. Otherwise render `<GenericNodeFallback>` so unknown types stay
 *      visible in the viewport.
 *
 * The dispatcher itself only renders nodes; it does NOT mount a `<Canvas>`
 * or any context providers — those are owned by `<TscnCanvas>` and
 * `<TscnPreviewShell>` respectively.
 *
 * Each rendered subtree is wrapped in `<PickableGroup>`, which attaches
 * the viewport selection handlers from `useViewportSelection` to the
 * subtree's pointer events. Click bubbles UP from the leaf mesh; the
 * handler at the leaf wins because R3F propagates pointer events from
 * the innermost hit object outward.
 */

import { Fragment } from 'react';
import type { ReactNode } from 'react';
import type { TscnNode } from '../parser/types.js';
import { joinPath } from '../utils/nodePath.js';
import { nodeComponentRegistry } from './NodeComponentRegistry.js';
import { GenericNodeFallback } from './nodes/generic-node-fallback/index.js';
import { useViewportSelection } from './hooks/useViewportSelection.js';
import { NodePathProvider } from './contexts/NodePathContext.js';

export interface NodeDispatcherProps {
  /** Root nodes from the active scene (typically `scene.scenes.get(rootScene).nodes`). */
  nodes: readonly TscnNode[];
}

export function NodeDispatcher({ nodes }: NodeDispatcherProps) {
  const { withNodePath } = useViewportSelection();
  return (
    <>
      {nodes.map((node) => (
        <DispatchedNode
          key={node.name}
          node={node}
          path={node.name}
          withNodePath={withNodePath}
        />
      ))}
    </>
  );
}

interface DispatchedNodeProps {
  node: TscnNode;
  path: string;
  withNodePath: (path: string) => ReturnType<ReturnType<typeof useViewportSelection>['withNodePath']>;
}

function DispatchedNode({ node, path, withNodePath }: DispatchedNodeProps): ReactNode {
  const Component = nodeComponentRegistry.get(node.type) ?? GenericNodeFallback;
  const handlers = withNodePath(path);

  const children = node.children.map((child) => (
    <DispatchedNode
      key={child.name}
      node={child}
      path={joinPath(path, child.name)}
      withNodePath={withNodePath}
    />
  ));

  // The pickable wrapper lives above the rendered component so that any
  // mesh / light / camera inside the subtree dispatches its pointer
  // events to the same node-path handler. Picking selects whichever node
  // OWNS the clicked geometry; if a child mesh is clicked, the child's
  // wrapper wins because R3F walks the hit-tree from inner to outer.
  //
  // `NodePathProvider` makes the path available to descendant components
  // (e.g. Camera3D tags its THREE.Camera with this so the canvas can
  // later swap to it on "Use This Camera").
  return (
    <NodePathProvider path={path}>
      <group
        onPointerDown={handlers.onPointerDown}
        onPointerUp={handlers.onPointerUp}
        onPointerOver={handlers.onPointerOver}
        onPointerOut={handlers.onPointerOut}
      >
        <Component node={node}>
          {children.length > 0 ? <Fragment>{children}</Fragment> : null}
        </Component>
      </group>
    </NodePathProvider>
  );
}
