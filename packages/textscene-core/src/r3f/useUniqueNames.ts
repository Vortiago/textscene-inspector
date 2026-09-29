/**
 * The owners a node resolves a NodePath against, read from the live scene tree: the `%Name`
 * claim table every hook that walks a `%Name` segment takes (ViewportTexture slots,
 * AnimationPlayer, AnimationTree), and a ViewportTexture's local scene.
 */

import { useMemo } from 'react';
import { useResourceLoader } from '../resources/useResource.js';
import {
  cachedUniqueNameClaims,
  uniqueNameLivePaths,
  type UniqueNameClaim,
} from '../utils/uniqueNames.js';
import { useOptionalHierarchy } from './contexts/HierarchyContext.js';
import { claimOwnerOf, localSceneClaims, localSceneOf, ownerClaims } from './uniqueNameOwner.js';
import { liveTreeContext, useLiveTreeVersion } from './useLiveSceneTree.js';

/**
 * The live tree, or null with no scene. With a path it re-reads on each load tick, since a
 * sub-scene node's owner is known only after the load.
 */
function useLiveTree(path?: string | null) {
  const graph = useOptionalHierarchy()?.sceneGraph;
  const loader = useResourceLoader();
  const version = useLiveTreeVersion(path ? loader : null);
  // `version` is the cache-buster for the loader's scene cache, which the
  // owner walk reads and which is mutated outside React.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => liveTreeContext(graph, loader), [graph, loader, version]);
}

/**
 * `paths` under one identity while its entries stay the same, since a sub-scene owner's
 * table is rebuilt on every load.
 */
function useStablePaths(
  paths: ReadonlyMap<string, string> | undefined
): ReadonlyMap<string, string> | undefined {
  const signature = useMemo(() => (paths ? JSON.stringify([...paths]) : null), [paths]);
  return useMemo(
    () => (signature === null ? undefined : new Map<string, string>(JSON.parse(signature))),
    [signature]
  );
}

/**
 * The `%Name` table the node at `path` resolves against, or undefined with no
 * scene. A flag says a node claimed a name, and only the first claimant keeps
 * it, so the answer needs the whole tree. It is per owner: a name registers on
 * the claimant's owner (node.cpp:2222-2234) and resolves through the caller's (node.cpp:1930-1938).
 */
export function useUniqueNameClaims(
  path?: string | null
): ReadonlyMap<string, UniqueNameClaim> | undefined {
  const live = useLiveTree(path);
  return useMemo(() => {
    if (!live) return undefined;
    // Without a path, the outer root's table, one shared object per tree.
    if (!path) return cachedUniqueNameClaims(live.roots);
    return ownerClaims(claimOwnerOf(path, live.roots, live.ctx));
  }, [live, path]);
}

/**
 * The `%Name` table the node at `path` resolves against, as the live paths the dispatcher
 * registers: the composed render tree spells a path as a claim's `livePath`.
 */
export function useUniqueNamePaths(path: string | null): ReadonlyMap<string, string> | undefined {
  const claims = useUniqueNameClaims(path);
  return useStablePaths(useMemo(() => claims && uniqueNameLivePaths(claims), [claims]));
}

/**
 * A local scene: the live path of its root, and the `%Name` table a walk from that root reads
 * ({@link localSceneClaims}). With no scene tree there is no table, so a `%Name` addresses
 * nothing.
 */
export interface LocalScene {
  readonly path: string;
  readonly uniquePaths?: ReadonlyMap<string, string>;
}

/**
 * The local scene of the node at `path` ({@link localSceneOf}), which a local-to-scene
 * resource's NodePaths measure from, or undefined with no path. With no scene tree there is no
 * owner to walk to, so the outer root, the first segment of `path`, is all there is.
 */
export function useLocalScene(path: string | null): LocalScene | undefined {
  const live = useLiveTree(path);
  const owner = useMemo(
    () => (live && path ? localSceneOf(path, live.roots, live.ctx) : undefined),
    [live, path]
  );
  // Keyed on the table, not the owner: the outer root's table is one cached object, while
  // the walk builds a fresh owner on every load tick.
  const claims = useMemo(() => owner && localSceneClaims(owner), [owner]);
  const uniquePaths = useStablePaths(
    useMemo(() => claims && uniqueNameLivePaths(claims), [claims])
  );
  const rootPath = owner?.path ?? path?.split('/')[0];
  return useMemo(
    () => (rootPath ? { path: rootPath, uniquePaths } : undefined),
    [rootPath, uniquePaths]
  );
}
