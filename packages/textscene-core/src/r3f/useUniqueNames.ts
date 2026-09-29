/**
 * The `%Name` claim tables a node resolves a NodePath against, read from the live scene tree:
 * every hook that walks a `%Name` segment (ViewportTexture slots, AnimationPlayer, AnimationTree)
 * takes its table from here.
 */

import { useMemo } from 'react';
import { useResourceLoader } from '../resources/useResource.js';
import {
  cachedUniqueNameClaims,
  uniqueNameLivePaths,
  type UniqueNameClaim,
} from '../utils/uniqueNames.js';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { claimOwnerOf, ownerClaims } from './uniqueNameOwner.js';
import { liveTreeContext, useLiveTreeVersion } from './useLiveSceneTree.js';

/**
 * The `%Name` table the node at `path` resolves against, or undefined with no
 * scene. A flag says a node claimed a name, and only the first claimant keeps
 * it, so the answer needs the whole tree. It is per owner: a name registers on
 * the claimant's owner (node.cpp:2222-2234) and resolves through the caller's (node.cpp:1930-1938).
 */
export function useUniqueNameClaims(
  path?: string | null
): ReadonlyMap<string, UniqueNameClaim> | undefined {
  const graph = useOptionalHierarchy()?.sceneGraph;
  const loader = useResourceLoader();
  const version = useLiveTreeVersion(path ? loader : null);
  return useMemo(() => {
    const live = liveTreeContext(graph, loader);
    if (!live) return undefined;
    // Without a path, the outer root's table, one shared object per tree. A
    // path re-derives on the version tick, since a sub-scene node's owner is
    // known only after the load.
    if (!path) return cachedUniqueNameClaims(live.roots);
    return ownerClaims(claimOwnerOf(path, live.roots, live.ctx));
    // `version` is the cache-buster for the loader's scene cache, which the
    // owner walk reads and which is mutated outside React.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, loader, version, path]);
}

/**
 * The `%Name` table the node at `path` resolves against, as the live paths the dispatcher
 * registers: the composed render tree spells a path as a claim's `livePath`. A rebuilt table with
 * the same entries keeps the old map, since a sub-scene owner's table is rebuilt on every load.
 */
export function useUniqueNamePaths(path: string | null): ReadonlyMap<string, string> | undefined {
  const claims = useUniqueNameClaims(path);
  const signature = useMemo(
    () => (claims ? JSON.stringify([...uniqueNameLivePaths(claims)]) : null),
    [claims]
  );
  return useMemo(
    () => (signature === null ? undefined : new Map<string, string>(JSON.parse(signature))),
    [signature]
  );
}
