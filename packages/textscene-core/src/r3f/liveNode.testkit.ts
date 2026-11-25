import { useMemo } from 'react';
import { resolveLiveEntry, type ResolvedLiveNode } from './liveSceneTree.js';
import { useSharedLiveTree } from './useLiveSceneTree.js';

/** Null for an empty path or one a sub-scene that has not landed would hold. */
export function useLiveNode(path: string | null | undefined): ResolvedLiveNode | null {
  const liveTree = useSharedLiveTree();
  return useMemo(
    () => (path && liveTree ? resolveLiveEntry(path, liveTree.roots, liveTree.ctx) : null),
    [liveTree, path]
  );
}
