/**
 * The one branch point of the dispatch walk, plus the resource scope a grafted
 * node needs around it. `NodeDispatcher.tsx` documents the walk as a whole.
 */

import type { ReactNode } from 'react';
import type { TscnExternalResource, TscnNode } from '../parser/types.js';
import {
  SceneResourcesProvider,
  useSceneResources,
} from './SceneResourcesContext.js';
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
 * `internalResources` is carried through untouched rather than reset: the
 * provider would default it to empty, and a grafted node's `SubResource(...)`
 * would then resolve to nothing. Those ids belong to the outer scene too, so
 * this is not yet exactly right — but no corpus scene puts a SubResource in a
 * deep override, and keeping what is in scope beats wiping it.
 */
function AuthoredResourceScope({
  resources,
  children,
}: {
  resources: readonly TscnExternalResource[];
  children: ReactNode;
}): ReactNode {
  const { internalResources } = useSceneResources();
  return (
    <SceneResourcesProvider externalResources={resources} internalResources={internalResources}>
      {children}
    </SceneResourcesProvider>
  );
}
