/**
 * The owners a node resolves a NodePath against, read from the live scene tree: the `%Name`
 * claim table every hook that walks a `%Name` segment takes (ViewportTexture slots,
 * AnimationPlayer, AnimationTree), and a ViewportTexture's local scene.
 */

import { useCallback, useMemo } from 'react';
import { claimOwnerOf, localSceneUniquePaths, localSceneOf, ownerUniquePaths } from './uniqueNameOwner.js';
import { sameEntries } from '../utils/sameEntries.js';
import { useLiveTreeSelection, type SharedLiveTree } from './useLiveSceneTree.js';

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
 * The `%Name` table the node at `path` resolves against, as the live paths the dispatcher
 * registers, or undefined with no scene. A flag says a node claimed a name, and only the first
 * claimant keeps it, so the answer needs the whole tree. It is per owner: a name registers on
 * the claimant's owner (node.cpp:2222-2234) and resolves through the caller's (node.cpp:1930-1938).
 */
export function useUniqueNamePaths(path: string | null): ReadonlyMap<string, string> | undefined {
  // Without a path, the outer root's table. An inherited root's table is rebuilt on every load,
  // so the reader compares entries and re-renders only where a name moved.
  const tableOf = useCallback(
    (live: SharedLiveTree) =>
      ownerUniquePaths(claimOwnerOf(path || (live.roots[0]?.name ?? ''), live.roots, live.ctx)),
    [path]
  );
  return useStablePaths(useLiveTreeSelection(tableOf, sameEntries));
}

/**
 * A local scene: the live path of its root, and the `%Name` table a walk from that root reads
 * ({@link localSceneUniquePaths}). With no scene tree there is no table, so a `%Name` addresses
 * nothing.
 */
interface LocalScene {
  readonly path: string;
  readonly uniquePaths?: ReadonlyMap<string, string>;
}

/** The root a local scene measures from, as the live tree places it. */
interface LocalSceneOwner {
  readonly path: string;
  readonly uniquePaths: ReadonlyMap<string, string>;
}

const sameLocalSceneOwner = (a: LocalSceneOwner, b: LocalSceneOwner) =>
  a.path === b.path && sameEntries(a.uniquePaths, b.uniquePaths);

/**
 * The local scene of the node at `path` ({@link localSceneOf}), which a local-to-scene
 * resource's NodePaths measure from, or undefined with no path. With no scene tree there is no
 * owner to walk to, so the outer root, the first segment of `path`, is all there is.
 */
export function useLocalScene(path: string | null): LocalScene | undefined {
  // With no path the reader asks nothing of the tree, so a load never re-renders it.
  const ownerOf = useCallback(
    (live: SharedLiveTree): LocalSceneOwner | undefined => {
      if (!path) return undefined;
      const owner = localSceneOf(path, live.roots, live.ctx);
      return { path: owner.path, uniquePaths: localSceneUniquePaths(owner) };
    },
    [path]
  );
  const owner = useLiveTreeSelection(ownerOf, sameLocalSceneOwner);
  const uniquePaths = useStablePaths(owner?.uniquePaths);
  const rootPath = owner?.path ?? path?.split('/')[0];
  return useMemo(() => (rootPath ? { path: rootPath, uniquePaths } : undefined), [rootPath, uniquePaths]);
}
