/**
 * The one branch point of the dispatch walk, plus the resource scope a grafted
 * node needs around it. `NodeDispatcher.tsx` documents the walk as a whole.
 */

import type { ReactNode } from 'react';
import type { TscnExternalResource, TscnNode } from '../parser/types.js';
import { SceneResourcesProvider } from './SceneResourcesContext.js';
import { InstancedNode } from './InstancedNode.js';
import { PlainNode } from './PlainNode.js';

export interface DispatchedNodeProps {
  node: TscnNode;
  path: string;
}

/**
 * Thin dispatch: a node with an `instance` ref resolves its sub-scene (and may
 * collapse via Instance root merge) in `InstancedNode`; every other node — and
 * every already-merged node — renders directly in `PlainNode`. Holds no hooks
 * itself so the branch is free of rules-of-hooks concerns.
 */
export function DispatchedNode({ node, path }: DispatchedNodeProps): ReactNode {
  const dispatched = node.instance ? (
    <InstancedNode node={node} path={path} />
  ) : (
    <PlainNode node={node} path={path} />
  );

  return node.authoredResources ? (
    <AuthoredResourceScope resources={node.authoredResources}>{dispatched}</AuthoredResourceScope>
  ) : (
    dispatched
  );
}

/**
 * Restore the ExtResource table a grafted node was authored against.
 *
 * A node grafted into content loaded from ANOTHER scene keeps rendering under
 * that scene's provider, where its `ExtResource("3")` is a different resource or
 * absent entirely — a failure that shows up as something plausible rather than
 * as nothing, which is the worse kind.
 *
 * Only the ExtResource table is declared here. `SceneResourcesProvider`
 * inherits the ambient SubResource pool by itself, so handing that pool back in
 * would prepend it to a copy of itself — once per graft, and again per nesting
 * level. A grafted node's `SubResource(...)` ids belong to the outer scene too,
 * so resolving them against the inherited pool is not yet exactly right.
 */
function AuthoredResourceScope({
  resources,
  children,
}: {
  resources: readonly TscnExternalResource[];
  children: ReactNode;
}): ReactNode {
  return <SceneResourcesProvider externalResources={resources}>{children}</SceneResourcesProvider>;
}
