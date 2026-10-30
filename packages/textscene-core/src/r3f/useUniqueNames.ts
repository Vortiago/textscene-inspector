/**
 * The owners a node resolves a NodePath against, read from the live scene tree: the `%Name`
 * claim table every hook that walks a `%Name` segment takes (ViewportTexture slots,
 * AnimationPlayer, AnimationTree), and a ViewportTexture's local scene.
 */

import { useCallback, useMemo } from 'react';
import { localSceneUniquePaths, localSceneOf } from './uniqueNameOwner.js';
import { nodePathUniquePaths } from './nodePathUniqueNames.js';
import { sameEntries } from '../utils/sameEntries.js';
import { useByValue } from './hooks/useByValue.js';
import { sameSelection, useLiveTreeSelection, type SharedLiveTree } from './useLiveSceneTree.js';

type UniquePaths = ReadonlyMap<string, string> | undefined;

/** Whether two tables hold the same entries. A sub-scene owner's table is rebuilt on every load. */
function samePaths(a: UniquePaths, b: UniquePaths): boolean {
  return sameSelection(a, b, sameEntries);
}

/**
 * The `%Name` table the node at `path` resolves against, as the live paths the dispatcher
 * registers, or undefined with no scene. A flag says a node claimed a name, and only the first
 * claimant keeps it, so the answer needs the whole tree. It is per owner: a name registers on
 * the claimant's owner (node.cpp:2222-2234) and resolves through {@link nodePathUniquePaths}.
 */
export function useUniqueNamePaths(path: string | null): ReadonlyMap<string, string> | undefined {
  // An inherited root's table is rebuilt on every load, so the reader compares entries and
  // re-renders only where a name moved.
  const tableOf = useCallback(
    (live: SharedLiveTree) => nodePathUniquePaths(path, live.roots, live.ctx),
    [path]
  );
  // The outer useByValue keeps the identity across a new `path`, which rebuilds the selection's
  // snapshot with no earlier value to compare.
  return useByValue(useLiveTreeSelection(tableOf, sameEntries), samePaths);
}

/**
 * A local scene: the live path of its root, and the `%Name` table a walk from that root reads
 * ({@link localSceneUniquePaths}). With no scene tree there is no table, so a `%Name` addresses
 * nothing.
 */
export interface LocalScene {
  readonly path: string;
  readonly uniquePaths?: ReadonlyMap<string, string>;
}

/** The root a local scene measures from, as the live tree places it. */
interface LocalSceneOwner {
  readonly path: string;
  readonly uniquePaths: ReadonlyMap<string, string>;
}

function localSceneOwnerOf(path: string, live: SharedLiveTree): LocalSceneOwner {
  const owner = localSceneOf(path, live.roots, live.ctx);
  return { path: owner.path, uniquePaths: localSceneUniquePaths(owner) };
}

/** The local scene of the node at `path`, as {@link useLocalScene} gives it, for a caller with no hooks. */
export function localSceneAt(path: string, live: SharedLiveTree | null): LocalScene {
  return live ? localSceneOwnerOf(path, live) : { path: path.split('/')[0]! };
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
      return localSceneOwnerOf(path, live);
    },
    [path]
  );
  const owner = useLiveTreeSelection(ownerOf, sameLocalSceneOwner);
  const uniquePaths = useByValue(owner?.uniquePaths, samePaths);
  const rootPath = owner?.path ?? path?.split('/')[0];
  return useMemo(() => (rootPath ? { path: rootPath, uniquePaths } : undefined), [rootPath, uniquePaths]);
}
